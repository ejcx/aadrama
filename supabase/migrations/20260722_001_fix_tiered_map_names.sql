-- Align tiered map names with tracker / map picker (get_distinct_maps).
-- Also remap any scrims already assigned with the old spreadsheet-style names.

UPDATE public.scrims SET map = 'Headquarters Raid' WHERE map = 'HQ Raid';
UPDATE public.scrims SET map = 'MOUT McKenna' WHERE map = 'MOUT Mckenna';
UPDATE public.scrims SET map = 'JRTC Farm Raid' WHERE map = 'JRTC Farm';
UPDATE public.scrims SET map = 'SF Taiga' WHERE map = 'SF Talga';
UPDATE public.scrims SET map = 'SMU GH RiverVillage' WHERE map = 'River Village';
UPDATE public.scrims SET map = 'SMU GH SFOldTown' WHERE map = 'SF Old Town';
UPDATE public.scrims SET map = 'SMU GH SFFloodgate' WHERE map = 'SF Floodgate';
UPDATE public.scrims SET map = 'SMU GH SFRefinery' WHERE map = 'SF Refinery';

CREATE OR REPLACE FUNCTION public.assign_tiered_map_if_needed(p_scrim_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map_choice TEXT;
  v_current_map TEXT;
  v_picked TEXT;
  v_total DOUBLE PRECISION;
BEGIN
  SELECT map_choice, map
  INTO v_map_choice, v_current_map
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_map_choice IS DISTINCT FROM 'tiered' THEN
    RETURN v_current_map;
  END IF;

  IF v_current_map IS NOT NULL THEN
    RETURN v_current_map;
  END IF;

  -- Absolute weights mirror lib/scrim/tiered-maps.ts (T1=2/3, T2–T6 = 5:4:3:2:1 of remainder)
  -- Map names must match get_distinct_maps / player_stats.map
  WITH pool AS (
    SELECT * FROM (VALUES
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
  WHERE c.cumulative >= r.roll * c.total
  ORDER BY c.cumulative
  LIMIT 1;

  IF v_picked IS NULL THEN
    -- Floating-point edge at roll≈1: pick heaviest tier-1 map
    v_picked := 'Insurgent Camp';
  END IF;

  UPDATE public.scrims
  SET map = v_picked
  WHERE id = p_scrim_id
    AND map_choice = 'tiered'
    AND map IS NULL;

  RETURN v_picked;
END;
$$;

COMMENT ON FUNCTION public.assign_tiered_map_if_needed IS
  'For map_choice=tiered scrims with null map: weighted-random assign a map. Names match get_distinct_maps. Idempotent. SECURITY DEFINER.';
