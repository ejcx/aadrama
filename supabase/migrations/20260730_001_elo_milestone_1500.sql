-- Add ELO 1500 milestone badge tier (highest only: 1300 / 1350 / 1400 / 1450 / 1500).
-- Backfills players whose peak cumulative ELO is >= 1500.

CREATE OR REPLACE FUNCTION public.elo_milestone_badge_types()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'elo_milestone_1300',
    'elo_milestone_1350',
    'elo_milestone_1400',
    'elo_milestone_1450',
    'elo_milestone_1500'
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
    WHEN 'elo_milestone_1500' THEN RETURN 1500;
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.elo_milestone_badge_for_elo(p_peak integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_peak >= 1500 THEN
    RETURN 'elo_milestone_1500';
  ELSIF p_peak >= 1450 THEN
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
      WHEN 'elo_milestone_1500' THEN 5
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

-- Backfill: upgrade anyone with peak cumulative ELO >= 1500 to the new tier.
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
      WHERE eh.elo_after >= 1500

      UNION

      SELECT pe.game_name_lower
      FROM public.player_elo pe
      WHERE pe.elo >= 1500
    ) s
    WHERE s.game_name_lower IS NOT NULL
  LOOP
    PERFORM public.sync_elo_milestone_badge(v_player);
    v_synced := v_synced + 1;
  END LOOP;

  RAISE NOTICE 'ELO 1500 milestone badges synced for % player(s).', v_synced;
END;
$$;
