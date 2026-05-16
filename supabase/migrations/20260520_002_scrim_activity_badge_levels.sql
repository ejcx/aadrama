-- Scrim activity badge: one per player, highest tier only (50 / 100 / 200 / 300 / 500 / 1000 ranked scrims).
-- Replaces stacking multiple season-1 activity badges. session_id: scrim-activity

CREATE OR REPLACE FUNCTION public.scrim_activity_badge_types()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'scrimlord',
    'cal_i_activity_confirmed',
    'keeping_the_game_alive',
    'always_online',
    'scrim_activity_500',
    'scrim_activity_1000'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.get_player_scrim_count(p_game_name_lower text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    coalesce(
      (
        SELECT mv.total_scrims
        FROM public.player_scrim_stats_mv mv
        WHERE mv.player_name_lower = lower(p_game_name_lower)
      ),
      0
    ),
    coalesce(
      (
        SELECT pe.games_played
        FROM public.player_elo pe
        WHERE pe.game_name_lower = lower(p_game_name_lower)
      ),
      0
    )
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.scrim_activity_badge_for_count(p_count integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_count >= 1000 THEN
    RETURN 'scrim_activity_1000';
  ELSIF p_count >= 500 THEN
    RETURN 'scrim_activity_500';
  ELSIF p_count >= 300 THEN
    RETURN 'always_online';
  ELSIF p_count >= 200 THEN
    RETURN 'keeping_the_game_alive';
  ELSIF p_count >= 100 THEN
    RETURN 'cal_i_activity_confirmed';
  ELSIF p_count >= 50 THEN
    RETURN 'scrimlord';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_scrim_activity_badge(
  p_game_name_lower text,
  p_earned_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lower text := lower(p_game_name_lower);
  v_count integer;
  v_target text;
  v_current text;
  v_game_name text;
BEGIN
  v_count := public.get_player_scrim_count(v_lower);
  v_target := public.scrim_activity_badge_for_count(v_count);

  SELECT pb.badge_type
  INTO v_current
  FROM public.player_badges pb
  WHERE pb.game_name_lower = v_lower
    AND pb.badge_type = ANY(public.scrim_activity_badge_types())
  ORDER BY
    CASE pb.badge_type
      WHEN 'scrim_activity_1000' THEN 6
      WHEN 'scrim_activity_500' THEN 5
      WHEN 'always_online' THEN 4
      WHEN 'keeping_the_game_alive' THEN 3
      WHEN 'cal_i_activity_confirmed' THEN 2
      WHEN 'scrimlord' THEN 1
      ELSE 0
    END DESC
  LIMIT 1;

  IF v_target IS NULL THEN
    DELETE FROM public.player_badges
    WHERE game_name_lower = v_lower
      AND badge_type = ANY(public.scrim_activity_badge_types());
    RETURN;
  END IF;

  IF v_current = v_target THEN
    RETURN;
  END IF;

  DELETE FROM public.player_badges
  WHERE game_name_lower = v_lower
    AND badge_type = ANY(public.scrim_activity_badge_types());

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
    v_target,
    coalesce(v_game_name, v_lower),
    v_lower,
    'scrim-activity',
    p_earned_at
  );
END;
$$;

COMMENT ON FUNCTION public.sync_scrim_activity_badge(text, timestamptz) IS
  'Sets the player scrim activity badge to their highest qualifying tier (replaces lower tiers).';

CREATE OR REPLACE FUNCTION public.try_sync_scrim_activity_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_scrim_activity_badge(NEW.game_name_lower, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_scrim_activity_on_elo_history ON public.elo_history;

CREATE TRIGGER sync_scrim_activity_on_elo_history
  AFTER INSERT ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.try_sync_scrim_activity_badge();

-- Cleanup: drop duplicate / legacy activity rows, then award highest tier per player.
REFRESH MATERIALIZED VIEW public.player_scrim_stats_mv;

DELETE FROM public.player_badges
WHERE badge_type = ANY(public.scrim_activity_badge_types());

DO $$
DECLARE
  v_player text;
  v_synced integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT s.game_name_lower
    FROM (
      SELECT mv.player_name_lower AS game_name_lower
      FROM public.player_scrim_stats_mv mv
      WHERE mv.total_scrims >= 50

      UNION

      SELECT pe.game_name_lower
      FROM public.player_elo pe
      WHERE pe.games_played >= 50
    ) s
    WHERE s.game_name_lower IS NOT NULL
  LOOP
    PERFORM public.sync_scrim_activity_badge(v_player, now());
    v_synced := v_synced + 1;
  END LOOP;

  RAISE NOTICE 'Scrim activity badges synced for % player(s).', v_synced;
END;
$$;
