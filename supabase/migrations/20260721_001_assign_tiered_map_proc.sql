-- Tiered map assignment in the database (runs whenever a scrim becomes in_progress).
-- Fixes app-side assignment that could silently no-op (RLS / race / missed code path).

-- Ensure column exists (safe if 20260720 already applied)
ALTER TABLE public.scrims
ADD COLUMN IF NOT EXISTS map_choice TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scrims_map_choice_check'
  ) THEN
    ALTER TABLE public.scrims
    ADD CONSTRAINT scrims_map_choice_check
    CHECK (map_choice IN ('manual', 'tiered'));
  END IF;
END $$;

-- Weighted random map pick for tiered scrims. Idempotent: only sets map when null.
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

GRANT EXECUTE ON FUNCTION public.assign_tiered_map_if_needed(UUID) TO authenticated, service_role, anon;

COMMENT ON FUNCTION public.assign_tiered_map_if_needed IS
  'For map_choice=tiered scrims with null map: weighted-random assign a map. Idempotent. SECURITY DEFINER.';

-- Fire automatically whenever a scrim enters in_progress (skill/random/captains/etc.)
CREATE OR REPLACE FUNCTION public.trg_scrims_assign_tiered_map()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'in_progress') THEN
    PERFORM public.assign_tiered_map_if_needed(NEW.id);
    -- Refresh NEW.map for AFTER triggers / returning rows (AFTER trigger; re-read)
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrims_assign_tiered_map_on_start ON public.scrims;

CREATE TRIGGER scrims_assign_tiered_map_on_start
AFTER UPDATE OF status ON public.scrims
FOR EACH ROW
EXECUTE FUNCTION public.trg_scrims_assign_tiered_map();

-- Also call explicitly at end of skill-based assignment (covers early-return races where
-- status was already in_progress before this session set teams — still safe/idempotent).
CREATE OR REPLACE FUNCTION assign_elo_optimized_random_teams(p_scrim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.scrims
    WHERE id = p_scrim_id AND status <> 'waiting'
  ) THEN
    -- Still ensure tiered map if teams already started without one
    PERFORM public.assign_tiered_map_if_needed(p_scrim_id);
    RETURN;
  END IF;

  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF player_count < 8 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', player_count;
  END IF;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)', player_count;
  END IF;

  half_count := player_count / 2;

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      COALESCE(pe.elo, 1200)::BIGINT AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  attempts AS (
    SELECT
      gs.attempt_num,
      pe.player_id,
      pe.elo,
      ROW_NUMBER() OVER (PARTITION BY gs.attempt_num ORDER BY random()) AS rn
    FROM player_elos pe
    CROSS JOIN generate_series(1, 100) AS gs(attempt_num)
  ),
  attempt_diffs AS (
    SELECT
      attempt_num,
      ABS(
        COALESCE(SUM(elo) FILTER (WHERE rn <= half_count), 0)
        - COALESCE(SUM(elo) FILTER (WHERE rn > half_count), 0)
      ) AS diff
    FROM attempts
    GROUP BY attempt_num
  ),
  best_attempt AS (
    SELECT attempt_num
    FROM attempt_diffs
    ORDER BY diff ASC, attempt_num ASC
    LIMIT 1
  ),
  best_teams AS (
    SELECT
      a.player_id,
      CASE WHEN a.rn <= half_count THEN 'team_a' ELSE 'team_b' END AS team
    FROM attempts a
    INNER JOIN best_attempt b ON a.attempt_num = b.attempt_num
  )
  UPDATE public.scrim_players sp
  SET team = bt.team
  FROM best_teams bt
  WHERE sp.id = bt.player_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF team_a_count IS DISTINCT FROM half_count OR team_b_count IS DISTINCT FROM half_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id AND status = 'waiting';

  -- Trigger also fires; explicit call keeps map assignment even if status update no-ops
  PERFORM public.assign_tiered_map_if_needed(p_scrim_id);
END;
$$;

CREATE OR REPLACE FUNCTION assign_skill_based_teams(p_scrim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assign_elo_optimized_random_teams(p_scrim_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_elo_optimized_random_teams(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_skill_based_teams(UUID) TO authenticated, service_role;
