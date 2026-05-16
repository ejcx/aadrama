-- Season 1 combat patch: players with 1–49 ranked scrims only (< 50).
-- Synced alongside scrim activity badges; removed when a player reaches Scrimlord (50+).

CREATE OR REPLACE FUNCTION public.sync_season_1_combat_patch(
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
  v_game_name text;
BEGIN
  v_count := public.get_player_scrim_count(v_lower);

  IF v_count < 1 OR v_count >= 50 THEN
    DELETE FROM public.player_badges
    WHERE game_name_lower = v_lower
      AND badge_type = 'season_1_combat_patch';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_badges pb
    WHERE pb.game_name_lower = v_lower
      AND pb.badge_type = 'season_1_combat_patch'
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
    'season_1_combat_patch',
    coalesce(v_game_name, v_lower),
    v_lower,
    'season-1',
    p_earned_at
  );
END;
$$;

COMMENT ON FUNCTION public.sync_season_1_combat_patch(text, timestamptz) IS
  'Awards Season 1 combat patch for 1–49 ranked scrims; revokes at 50+ (Scrimlord tier).';

CREATE OR REPLACE FUNCTION public.try_sync_scrim_activity_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_scrim_activity_badge(NEW.game_name_lower, NEW.created_at);
  PERFORM public.sync_season_1_combat_patch(NEW.game_name_lower, NEW.created_at);
  RETURN NEW;
END;
$$;

REFRESH MATERIALIZED VIEW public.player_scrim_stats_mv;

-- Revoke combat patch from players who reached 50+ ranked scrims.
DELETE FROM public.player_badges pb
WHERE pb.badge_type = 'season_1_combat_patch'
  AND public.get_player_scrim_count(pb.game_name_lower) >= 50;

-- Grant combat patch to eligible players (1–49 scrims) missing it.
INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'season_1_combat_patch',
  p.game_name,
  p.game_name_lower,
  'season-1',
  now()
FROM (
  SELECT
    coalesce(pe.game_name, mv.player_name) AS game_name,
    coalesce(mv.player_name_lower, pe.game_name_lower) AS game_name_lower,
    public.get_player_scrim_count(coalesce(mv.player_name_lower, pe.game_name_lower)) AS scrim_count
  FROM public.player_scrim_stats_mv mv
  FULL OUTER JOIN public.player_elo pe
    ON pe.game_name_lower = mv.player_name_lower
  WHERE coalesce(mv.player_name_lower, pe.game_name_lower) IS NOT NULL
) p
WHERE p.scrim_count >= 1
  AND p.scrim_count < 50
  AND NOT EXISTS (
    SELECT 1
    FROM public.player_badges pb
    WHERE pb.game_name_lower = p.game_name_lower
      AND pb.badge_type = 'season_1_combat_patch'
  );

DO $$
DECLARE
  v_player text;
  v_synced integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT coalesce(mv.player_name_lower, pe.game_name_lower)
    FROM public.player_scrim_stats_mv mv
    FULL OUTER JOIN public.player_elo pe
      ON pe.game_name_lower = mv.player_name_lower
    WHERE coalesce(mv.player_name_lower, pe.game_name_lower) IS NOT NULL
      AND public.get_player_scrim_count(coalesce(mv.player_name_lower, pe.game_name_lower)) >= 1
  LOOP
    PERFORM public.sync_season_1_combat_patch(v_player);
    PERFORM public.sync_scrim_activity_badge(v_player);
    v_synced := v_synced + 1;
  END LOOP;

  RAISE NOTICE 'Scrim participation badges (activity + combat patch) synced for % player(s).', v_synced;
END;
$$;
