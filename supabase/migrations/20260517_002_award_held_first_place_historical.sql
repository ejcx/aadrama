-- Award held_first_place (#1 ELO) to everyone who ever reached global rank 1
-- (replay elo_history). Idempotent via session_id 'held-first-place'.

WITH RECURSIVE
ordered AS (
  SELECT
    id,
    game_name_lower,
    elo_after,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS step
  FROM public.elo_history
),
replay AS (
  SELECT
    o.step,
    o.game_name_lower,
    jsonb_build_object(o.game_name_lower, o.elo_after) AS ratings
  FROM ordered o
  WHERE o.step = 1

  UNION ALL

  SELECT
    o.step,
    o.game_name_lower,
    r.ratings || jsonb_build_object(o.game_name_lower, o.elo_after)
  FROM ordered o
  INNER JOIN replay r ON o.step = r.step + 1
),
leaders AS (
  SELECT
    r.step,
    (
      SELECT array_agg(e.key ORDER BY e.key)
      FROM jsonb_each_text(r.ratings) AS e(key, val)
      WHERE val::int = (
        SELECT max(v.val::int)
        FROM jsonb_each_text(r.ratings) AS v(key, val)
      )
    ) AS leaders_at_step
  FROM replay r
),
ever_first AS (
  SELECT DISTINCT leader AS game_name_lower
  FROM leaders l
  CROSS JOIN LATERAL unnest(l.leaders_at_step) AS leader
  WHERE l.leaders_at_step IS NOT NULL
)
INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'held_first_place',
  coalesce(pe.game_name, ef.game_name_lower),
  ef.game_name_lower,
  'held-first-place',
  now()
FROM ever_first ef
LEFT JOIN public.player_elo pe ON pe.game_name_lower = ef.game_name_lower
WHERE NOT EXISTS (
  SELECT 1
  FROM public.player_badges pb
  WHERE pb.game_name_lower = ef.game_name_lower
    AND pb.badge_type = 'held_first_place'
    AND pb.session_id = 'held-first-place'
);
