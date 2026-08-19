-- Complete map-reroll setup (idempotent — safe if 20260818 was already applied).
-- Includes: voted_map_reroll column, reroll RPCs, and scrims_with_counts refresh
-- so map_choice is visible to the client (required for the Reroll Map UI).

-- ---------------------------------------------------------------------------
-- 1) Vote column
-- ---------------------------------------------------------------------------
ALTER TABLE public.scrim_players
ADD COLUMN IF NOT EXISTS voted_map_reroll BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2) Weighted pick (excludes current map on reroll)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_weighted_tiered_map(p_exclude TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_picked TEXT;
  v_total DOUBLE PRECISION;
BEGIN
  WITH pool AS (
    SELECT t.map_name, t.weight
    FROM (VALUES
      ('Insurgent Camp', 0.1600000000000000),
      ('Pipeline', 0.0888888888888889),
      ('Weapons Cache', 0.0800000000000000),
      ('Collapsed Tunnel', 0.0800000000000000),
      ('Urban Assault', 0.1244444444444444),
      ('MOUT McKenna', 0.1333333333333333),
      ('Mountain Ambush', 0.0130718954248366),
      ('Headquarters Raid', 0.0163398692810458),
      ('SF Sandstorm', 0.0196078431372549),
      ('Weapons Cache SE', 0.0098039215686275),
      ('SF CSAR', 0.0130718954248366),
      ('Mountain Pass SE', 0.0032679738562092),
      ('Dusk', 0.0130718954248366),
      ('River Basin', 0.0065359477124183),
      ('Canyon', 0.0163398692810458),
      ('JRTC Farm Raid', 0.0143369175627240),
      ('Woodland Outpost', 0.0143369175627240),
      ('Border', 0.0143369175627240),
      ('Radio Tower', 0.0035842293906810),
      ('SF Taiga', 0.0035842293906810),
      ('Pipeline SF', 0.0057347670250896),
      ('Bridge SE', 0.0157706093189964),
      ('SMU GH RiverVillage', 0.0172043010752688),
      ('SF Hospital', 0.0027777777777778),
      ('SF Dockside', 0.0027777777777778),
      ('Mountain Pass', 0.0027777777777778),
      ('Swamp Raid', 0.0222222222222222),
      ('SF Village', 0.0111111111111111),
      ('SF Oasis', 0.0111111111111111),
      ('SF Courtyard', 0.0138888888888889),
      ('Rummage', 0.0106666666666667),
      ('SMU GH SFOldTown', 0.0088888888888889),
      ('SF Blizzard', 0.0066666666666667),
      ('SF Recon', 0.0026666666666667),
      ('SF Arctic', 0.0017777777777778),
      ('SF Water Treatment', 0.0031111111111111),
      ('Bridge Crossing', 0.0106666666666667),
      ('District', 0.0157777777777778),
      ('SF PCR', 0.0022222222222222),
      ('SMU GH SFFloodgate', 0.0022222222222222),
      ('SMU GH SFRefinery', 0.0011111111111111),
      ('Steamroller', 0.0004444444444444),
      ('SF Extraction', 0.0004444444444444)
    ) AS t(map_name, weight)
    WHERE p_exclude IS NULL OR t.map_name IS DISTINCT FROM p_exclude
  ),
  totals AS (
    SELECT COALESCE(SUM(weight), 0)::DOUBLE PRECISION AS total FROM pool
  ),
  cum AS (
    SELECT
      p.map_name,
      SUM(p.weight) OVER (ORDER BY p.map_name ROWS UNBOUNDED PRECEDING) AS cumulative,
      t.total
    FROM pool p
    CROSS JOIN totals t
  )
  SELECT c.map_name, c.total
  INTO v_picked, v_total
  FROM cum c
  CROSS JOIN (SELECT random() AS roll) r
  WHERE c.total > 0
    AND c.cumulative >= r.roll * c.total
  ORDER BY c.cumulative
  LIMIT 1;

  IF v_picked IS NULL THEN
    IF p_exclude IS NOT NULL THEN
      RETURN public.pick_weighted_tiered_map(NULL);
    END IF;
    v_picked := 'Insurgent Camp';
  END IF;

  RETURN v_picked;
END;
$$;

COMMENT ON FUNCTION public.pick_weighted_tiered_map IS
  'Weighted-random map from the tiered pool. Optional p_exclude avoids re-picking the same map.';

-- ---------------------------------------------------------------------------
-- 3) Execute map reroll
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reroll_tiered_map(p_scrim_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map_choice TEXT;
  v_current_map TEXT;
  v_status TEXT;
  v_picked TEXT;
BEGIN
  SELECT map_choice, map, status
  INTO v_map_choice, v_current_map, v_status
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim not found';
  END IF;

  IF v_map_choice IS DISTINCT FROM 'tiered' THEN
    RAISE EXCEPTION 'Map reroll is only available for tiered (random map) scrims';
  END IF;

  IF v_current_map IS NULL THEN
    RAISE EXCEPTION 'Cannot reroll map before one has been assigned';
  END IF;

  IF v_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Can only reroll map during in_progress phase';
  END IF;

  v_picked := public.pick_weighted_tiered_map(v_current_map);

  UPDATE public.scrims
  SET map = v_picked
  WHERE id = p_scrim_id;

  UPDATE public.scrim_players
  SET voted_map_reroll = FALSE
  WHERE scrim_id = p_scrim_id;

  RETURN v_picked;
END;
$$;

COMMENT ON FUNCTION public.reroll_tiered_map IS
  'Reassigns a weighted-random map for a tiered scrim (excludes current map). Resets map reroll votes.';

CREATE OR REPLACE FUNCTION public.check_and_execute_map_reroll(p_scrim_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_players INTEGER;
  votes_for_reroll INTEGER;
  votes_needed INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_players
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  SELECT COUNT(*) INTO votes_for_reroll
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND voted_map_reroll = TRUE;

  votes_needed := (total_players / 2) + 1;

  IF votes_for_reroll >= votes_needed THEN
    RETURN public.reroll_tiered_map(p_scrim_id);
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.check_and_execute_map_reroll IS
  'If map-reroll vote threshold is met, executes reroll and returns the new map; otherwise NULL.';

CREATE OR REPLACE FUNCTION public.get_map_reroll_status(p_scrim_id UUID)
RETURNS TABLE(
  total_players INTEGER,
  votes_for_reroll INTEGER,
  votes_needed INTEGER,
  can_reroll BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total INTEGER;
  votes INTEGER;
  needed INTEGER;
BEGIN
  SELECT COUNT(*) INTO total
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  SELECT COUNT(*) INTO votes
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND voted_map_reroll = TRUE;

  needed := (total / 2) + 1;

  RETURN QUERY SELECT total, votes, needed, (votes >= needed);
END;
$$;

COMMENT ON FUNCTION public.get_map_reroll_status IS
  'Returns current map-reroll voting status for a scrim';

GRANT EXECUTE ON FUNCTION public.pick_weighted_tiered_map(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.reroll_tiered_map(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_and_execute_map_reroll(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_map_reroll_status(UUID) TO authenticated, service_role, anon;

-- ---------------------------------------------------------------------------
-- 4) Refresh scrims_with_counts so map_choice (and other new columns) appear
--    Postgres expands s.* at CREATE VIEW time — recreate after ALTER TABLE.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.scrims_with_counts;

CREATE VIEW public.scrims_with_counts AS
SELECT
  s.*,
  COALESCE(pc.player_count, 0) AS player_count,
  COALESCE(pc.ready_count, 0) AS ready_count,
  COALESCE(pc.reroll_votes, 0) AS reroll_votes,
  COALESCE(sc.score_submission_count, 0) AS score_submission_count
FROM public.scrims s
LEFT JOIN (
  SELECT
    scrim_id,
    COUNT(*) AS player_count,
    COUNT(*) FILTER (WHERE is_ready) AS ready_count,
    COUNT(*) FILTER (WHERE voted_reroll) AS reroll_votes
  FROM public.scrim_players
  GROUP BY scrim_id
) pc ON s.id = pc.scrim_id
LEFT JOIN (
  SELECT scrim_id, COUNT(*) AS score_submission_count
  FROM public.scrim_score_submissions
  GROUP BY scrim_id
) sc ON s.id = sc.scrim_id;

GRANT SELECT ON public.scrims_with_counts TO anon, authenticated;

COMMENT ON VIEW public.scrims_with_counts IS
  'Scrims with player/ready/reroll counts. Recreate after adding columns to public.scrims.';
