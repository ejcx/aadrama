-- ELO milestone badge: one per player, highest tier only (1300 / 1350 / 1400 / 1450 peak cumulative ELO).
-- Replaces stacking multiple milestone badges. session_id: elo-milestone

CREATE OR REPLACE FUNCTION public.elo_milestone_badge_types()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'elo_milestone_1300',
    'elo_milestone_1350',
    'elo_milestone_1400',
    'elo_milestone_1450'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.elo_milestone_threshold_for_badge(p_badge_type text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_badge_type
    WHEN 'elo_milestone_1300' THEN RETURN 1300;
    WHEN 'elo_milestone_1350' THEN RETURN 1350;
    WHEN 'elo_milestone_1400' THEN RETURN 1400;
    WHEN 'elo_milestone_1450' THEN RETURN 1450;
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_peak_elo(p_game_name_lower text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(
    coalesce(
      (
        SELECT max(eh.elo_after)
        FROM public.elo_history eh
        WHERE eh.game_name_lower = lower(p_game_name_lower)
      ),
      0
    ),
    coalesce(
      (
        SELECT pe.elo
        FROM public.player_elo pe
        WHERE pe.game_name_lower = lower(p_game_name_lower)
      ),
      0
    )
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.elo_milestone_badge_for_elo(p_peak integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_peak >= 1450 THEN
    RETURN 'elo_milestone_1450';
  ELSIF p_peak >= 1400 THEN
    RETURN 'elo_milestone_1400';
  ELSIF p_peak >= 1350 THEN
    RETURN 'elo_milestone_1350';
  ELSIF p_peak >= 1300 THEN
    RETURN 'elo_milestone_1300';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.first_elo_milestone_reached_at(
  p_game_name_lower text,
  p_badge_type text
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(eh.created_at)
  FROM public.elo_history eh
  WHERE eh.game_name_lower = lower(p_game_name_lower)
    AND eh.elo_after >= public.elo_milestone_threshold_for_badge(p_badge_type);
$$;

CREATE OR REPLACE FUNCTION public.sync_elo_milestone_badge(
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
  v_peak integer;
  v_target text;
  v_current text;
  v_game_name text;
  v_earned timestamptz;
BEGIN
  v_peak := public.get_player_peak_elo(v_lower);
  v_target := public.elo_milestone_badge_for_elo(v_peak);

  SELECT pb.badge_type
  INTO v_current
  FROM public.player_badges pb
  WHERE pb.game_name_lower = v_lower
    AND pb.badge_type = ANY(public.elo_milestone_badge_types())
  ORDER BY
    CASE pb.badge_type
      WHEN 'elo_milestone_1450' THEN 4
      WHEN 'elo_milestone_1400' THEN 3
      WHEN 'elo_milestone_1350' THEN 2
      WHEN 'elo_milestone_1300' THEN 1
      ELSE 0
    END DESC
  LIMIT 1;

  IF v_target IS NULL THEN
    DELETE FROM public.player_badges
    WHERE game_name_lower = v_lower
      AND badge_type = ANY(public.elo_milestone_badge_types());
    RETURN;
  END IF;

  IF v_current = v_target THEN
    RETURN;
  END IF;

  v_earned := coalesce(
    p_earned_at,
    public.first_elo_milestone_reached_at(v_lower, v_target),
    now()
  );

  DELETE FROM public.player_badges
  WHERE game_name_lower = v_lower
    AND badge_type = ANY(public.elo_milestone_badge_types());

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
    'elo-milestone',
    v_earned
  );
END;
$$;

COMMENT ON FUNCTION public.sync_elo_milestone_badge(text, timestamptz) IS
  'Sets the player ELO milestone badge to their highest qualifying tier (replaces lower tiers).';

CREATE OR REPLACE FUNCTION public.try_sync_elo_milestone_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_elo_milestone_badge(NEW.game_name_lower, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_elo_milestone_badges_on_elo_history ON public.elo_history;
DROP FUNCTION IF EXISTS public.try_award_elo_milestone_badges();

CREATE TRIGGER sync_elo_milestone_on_elo_history
  AFTER INSERT ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.try_sync_elo_milestone_badge();

-- Cleanup: drop duplicate / legacy milestone rows, then award highest tier per player.
DELETE FROM public.player_badges
WHERE badge_type = ANY(public.elo_milestone_badge_types());

DO $$
DECLARE
  v_player text;
  v_synced integer := 0;
BEGIN
  FOR v_player IN
    SELECT DISTINCT s.game_name_lower
    FROM (
      SELECT eh.game_name_lower
      FROM public.elo_history eh
      WHERE eh.elo_after >= 1300

      UNION

      SELECT pe.game_name_lower
      FROM public.player_elo pe
      WHERE pe.elo >= 1300
    ) s
    WHERE s.game_name_lower IS NOT NULL
  LOOP
    PERFORM public.sync_elo_milestone_badge(v_player);
    v_synced := v_synced + 1;
  END LOOP;

  RAISE NOTICE 'ELO milestone badges synced for % player(s).', v_synced;
END;
$$;
