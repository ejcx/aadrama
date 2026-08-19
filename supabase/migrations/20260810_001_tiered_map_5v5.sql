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

CREATE OR REPLACE FUNCTION public.assign_tiered_map_five(p_scrim_id UUID)
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
      ('Insurgent Camp', 0.1100000000000000),
      ('Urban Assault', 0.1100000000000000),
      ('MOUT McKenna', 0.1100000000000000),
      ('Canyon', 0.0800000000000000),
      ('Woodland Outpost', 0.0800000000000000),
      ('SF Sandstorm', 0.0700000000000000),
      ('District', 0.0500000000000000),
      ('Headquarters Raid', 0.0500000000000000),
      ('Mountain Ambush', 0.0400000000000000),
      ('SMU GH RiverVillage', 0.0400000000000000),
      ('[AA3] Impact', 0.0400000000000000),
      ('Pipeline', 0.0400000000000000),
      ('Weapons Cache', 0.0400000000000000),
      ('Dusk', 0.0300000000000000),
      ('SF Hospital', 0.0300000000000000),
      ('Border', 0.0300000000000000),
      ('Bridge SE', 0.0222222222222222),
      ('River Basin', 0.0222222222222222),
      ('SF Dockside', 0.0222222222222222),
      ('Rummage', 0.0222222222222222),
      ('Swamp Raid', 0.0222222222222222),
      ('SF PCR', 0.0222222222222222),
      ('Weapons Cache SE', 0.0111111111111111),
      ('Mountain Pass SE', 0.0111111111111111),
      ('SF Blizzard', 0.0111111111111111),
      ('JRTC Farm Raid', 0.0111111111111111),
      ('Collapsed Tunnel', 0.0080000000000000),
      ('SF Oasis', 0.0050000000000000),
      ('SMU GH SFOldTown', 0.0050000000000000),
      ('SF Extraction', 0.0004444444444444)
      ('SF Taiga', 0.00022222222222222),
      ('SF Water Treatment', 0.00022222222222222),
      ('SMU GH SFFloodgate', 0.00022222222222222),
      ('SF Arctic', 0.00017777777777778),
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

COMMENT ON FUNCTION public.assign_tiered_map_six_plus IS
  'For map_choice=tiered scrims with null map: weighted-random assign a map. Names match get_distinct_maps. Idempotent. SECURITY DEFINER.';
