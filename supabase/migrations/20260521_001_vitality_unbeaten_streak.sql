-- Vitality: 10 ranked scrims in a row without a loss (wins and draws count).
-- One badge per player (session_id: vitality). Historical backfill + award on elo_history insert.

CREATE OR REPLACE FUNCTION public.first_unbeaten_streak_milestone_at(
  p_game_name_lower text,
  p_streak integer DEFAULT 10
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      eh.created_at,
      sum(CASE WHEN eh.result = 'loss' THEN 1 ELSE 0 END)
        OVER (ORDER BY eh.created_at ROWS UNBOUNDED PRECEDING) AS segment_id
    FROM public.elo_history eh
    WHERE eh.game_name_lower = lower(p_game_name_lower)
  ),
  numbered AS (
    SELECT
      o.created_at,
      row_number() OVER (PARTITION BY o.segment_id ORDER BY o.created_at) AS seg_rn
    FROM ordered o
  )
  SELECT n.created_at
  FROM numbered n
  WHERE n.seg_rn = p_streak
  ORDER BY n.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.first_unbeaten_streak_milestone_scrim_id(
  p_game_name_lower text,
  p_streak integer DEFAULT 10
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      eh.scrim_id,
      eh.created_at,
      sum(CASE WHEN eh.result = 'loss' THEN 1 ELSE 0 END)
        OVER (ORDER BY eh.created_at ROWS UNBOUNDED PRECEDING) AS segment_id
    FROM public.elo_history eh
    WHERE eh.game_name_lower = lower(p_game_name_lower)
  ),
  numbered AS (
    SELECT
      o.scrim_id,
      o.created_at,
      row_number() OVER (PARTITION BY o.segment_id ORDER BY o.created_at) AS seg_rn
    FROM ordered o
  )
  SELECT n.scrim_id
  FROM numbered n
  WHERE n.seg_rn = p_streak
  ORDER BY n.created_at
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.first_unbeaten_streak_milestone_at(text, integer) IS
  'When the player first reached p_streak consecutive ranked scrims without a loss (win/draw).';

CREATE OR REPLACE FUNCTION public.sync_vitality_badge(
  p_game_name_lower text,
  p_earned_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lower text := lower(p_game_name_lower);
  v_earned timestamptz;
  v_game_name text;
BEGIN
  v_earned := coalesce(p_earned_at, public.first_unbeaten_streak_milestone_at(v_lower, 10));

  IF v_earned IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_badges pb
    WHERE pb.game_name_lower = v_lower
      AND pb.badge_type = 'vitality'
  ) THEN
    RETURN;
  END IF;

  SELECT pe.game_name
  INTO v_game_name
  FROM public.player_elo pe
  WHERE pe.game_name_lower = v_lower;

  INSERT INTO public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  VALUES (
    'vitality',
    coalesce(v_game_name, v_lower),
    v_lower,
    'vitality',
    v_earned
  )
  ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.sync_vitality_badge(text, timestamptz) IS
  'Awards vitality when the player has a 10-scrim unbeaten streak (wins/draws only).';

CREATE OR REPLACE FUNCTION public.try_award_vitality_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.result = 'loss' THEN
    RETURN NEW;
  END IF;

  IF NEW.scrim_id IS DISTINCT FROM public.first_unbeaten_streak_milestone_scrim_id(NEW.game_name_lower, 10) THEN
    RETURN NEW;
  END IF;

  PERFORM public.sync_vitality_badge(NEW.game_name_lower, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_vitality_on_elo_history ON public.elo_history;

CREATE TRIGGER award_vitality_on_elo_history
  AFTER INSERT ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.try_award_vitality_badge();

-- Historical backfill
INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'vitality',
  coalesce(pe.game_name, p.game_name_lower),
  p.game_name_lower,
  'vitality',
  s.earned_at
FROM (
  SELECT DISTINCT eh.game_name_lower
  FROM public.elo_history eh
) p
CROSS JOIN LATERAL (
  SELECT public.first_unbeaten_streak_milestone_at(p.game_name_lower, 10) AS earned_at
) s
LEFT JOIN public.player_elo pe ON pe.game_name_lower = p.game_name_lower
WHERE s.earned_at IS NOT NULL
ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;

DO $$
DECLARE
  v_player text;
  v_synced integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT eh.game_name_lower
    FROM public.elo_history eh
    WHERE public.first_unbeaten_streak_milestone_at(eh.game_name_lower, 10) IS NOT NULL
  LOOP
    PERFORM public.sync_vitality_badge(v_player);
    v_synced := v_synced + 1;
  END LOOP;

  RAISE NOTICE 'Vitality badges synced for % player(s).', v_synced;
END;
$$;
