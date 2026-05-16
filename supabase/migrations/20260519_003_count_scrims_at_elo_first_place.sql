-- Count ranked scrims a player completed while tied for global ELO #1.
-- Used on profiles for the held_first_place (#1 ELO) badge.

CREATE OR REPLACE FUNCTION public.count_scrims_at_elo_first_place(p_game_name_lower text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      o.elo_after,
      jsonb_build_object(o.game_name_lower, o.elo_after) AS ratings
    FROM ordered o
    WHERE o.step = 1

    UNION ALL

    SELECT
      o.step,
      o.game_name_lower,
      o.elo_after,
      r.ratings || jsonb_build_object(o.game_name_lower, o.elo_after)
    FROM ordered o
    INNER JOIN replay r ON o.step = r.step + 1
  ),
  at_first AS (
    SELECT r.step
    FROM replay r
    WHERE r.game_name_lower = lower(p_game_name_lower)
      AND r.elo_after = (
        SELECT max(v.val::int)
        FROM jsonb_each_text(r.ratings) AS v(key, val)
      )
  )
  SELECT count(*)::integer FROM at_first;
$$;

COMMENT ON FUNCTION public.count_scrims_at_elo_first_place(text) IS
  'Returns how many ranked scrims the player finished while at global ELO #1 (ties count).';

GRANT EXECUTE ON FUNCTION public.count_scrims_at_elo_first_place(text) TO anon, authenticated, service_role;
