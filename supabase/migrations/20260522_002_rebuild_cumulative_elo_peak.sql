-- Rebuild cumulative elo_before / elo_after from elo_change (for profile peak ELO).
-- Run after manually recalculating Season 2 ranked games.
--
-- In Supabase SQL editor:
--   SELECT rebuild_cumulative_elo_history_totals();
--   SELECT rebuild_all_player_elo_from_history();
--   SELECT sync_all_elo_milestone_badges();

CREATE OR REPLACE FUNCTION public.rebuild_cumulative_elo_history_totals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  WITH ordered AS (
    SELECT
      eh.id,
      coalesce(eh.elo_change, 0) AS elo_change,
      sum(coalesce(eh.elo_change, 0)) OVER (
        PARTITION BY eh.game_name_lower
        ORDER BY eh.created_at ASC, eh.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cum_after
    FROM public.elo_history eh
  )
  UPDATE public.elo_history eh
  SET
    elo_before = 1200 + o.cum_after - o.elo_change,
    elo_after = 1200 + o.cum_after
  FROM ordered o
  WHERE eh.id = o.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.rebuild_cumulative_elo_history_totals() IS
  'Sets elo_before/elo_after on every elo_history row to cumulative 1200 + running sum(elo_change). Use after bulk ELO fixes.';

CREATE OR REPLACE FUNCTION public.rebuild_cumulative_elo_history_for_players(
  p_game_names_lower text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_names text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT lower(trim(n))), ARRAY[]::text[])
  INTO v_names
  FROM unnest(coalesce(p_game_names_lower, ARRAY[]::text[])) AS n
  WHERE nullif(trim(n), '') IS NOT NULL;

  IF coalesce(array_length(v_names, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  WITH ordered AS (
    SELECT
      eh.id,
      coalesce(eh.elo_change, 0) AS elo_change,
      sum(coalesce(eh.elo_change, 0)) OVER (
        PARTITION BY eh.game_name_lower
        ORDER BY eh.created_at ASC, eh.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cum_after
    FROM public.elo_history eh
    WHERE eh.game_name_lower = ANY (v_names)
  )
  UPDATE public.elo_history eh
  SET
    elo_before = 1200 + o.cum_after - o.elo_change,
    elo_after = 1200 + o.cum_after
  FROM ordered o
  WHERE eh.id = o.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.rebuild_cumulative_elo_history_for_players(text[]) IS
  'Rebuilds cumulative elo_before/elo_after for specific players (e.g. after admin recalculate).';

CREATE OR REPLACE FUNCTION public.rebuild_all_player_elo_from_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player text;
  v_count integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT eh.game_name_lower
    FROM public.elo_history eh
    ORDER BY 1
  LOOP
    PERFORM public.recalculate_player_elo_from_history(v_player);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.rebuild_all_player_elo_from_history() IS
  'Rebuilds every player_elo row from elo_history (current elo = latest elo_after).';

CREATE OR REPLACE FUNCTION public.sync_all_elo_milestone_badges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player text;
  v_count integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT eh.game_name_lower
    FROM public.elo_history eh
    ORDER BY 1
  LOOP
    PERFORM public.sync_elo_milestone_badge(v_player);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.sync_all_elo_milestone_badges() IS
  'Re-syncs ELO milestone badges from peak cumulative ELO (max elo_after).';
