-- Map choice 'veto': 4 maps are drawn from the tiered pool and players vote on
-- them in the lobby, before teams are picked. Most votes wins. A tie for first
-- is settled by a random pick between the tied maps.
--
-- Only adds things: 5 columns, 5 functions, and 'veto' in the map_choice check.
-- No existing function, trigger or view is changed.
--
-- To run: paste the whole file into the SQL editor (nothing highlighted) and
-- run it before deploying the app code. It is one transaction, so a failure
-- changes nothing. Safe to run again.
--
-- This is the only SQL file to run for this change. ROLLBACK_scrim_map_veto.sql
-- is the undo script. Do not run it unless you are removing veto.

BEGIN;

-- The ALTERs need a short exclusive lock on scrims and scrim_players. If
-- another query is holding those tables, fail after 3 seconds instead of
-- making every scrim page wait. Nothing is changed in that case. Run it again.
SET LOCAL lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 0) Pre-flight: stop with a clear message if something the new functions
--    need is missing. Postgres would not notice until they are called.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_other TEXT;
BEGIN
  IF to_regprocedure('public.pick_weighted_tiered_map(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'function pick_weighted_tiered_map(text) (apply 20260819_001_map_reroll_complete.sql)');
  END IF;
  IF to_regprocedure('public.assign_purely_random_teams(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function assign_purely_random_teams(uuid) (apply 20260116_002_force_couple_together.sql)');
  END IF;
  IF to_regclass('public.user_game_names') IS NULL THEN v_missing := array_append(v_missing, 'table user_game_names'); END IF;
  IF to_regclass('public.player_elo') IS NULL THEN v_missing := array_append(v_missing, 'table player_elo'); END IF;

  SELECT v_missing || COALESCE(array_agg(need.tbl || '.' || need.col), ARRAY[]::TEXT[])
  INTO v_missing
  FROM (VALUES
    ('scrims', 'map'), ('scrims', 'map_choice'), ('scrims', 'selection_mode'), ('scrims', 'status'),
    ('scrims', 'expires_at'), ('scrims', 'min_players_per_team'),
    ('scrim_players', 'scrim_id'), ('scrim_players', 'user_id'), ('scrim_players', 'is_ready'),
    ('scrim_players', 'team'), ('scrim_players', 'voted_reroll'), ('scrim_players', 'voted_map_reroll')
  ) AS need(tbl, col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = need.tbl AND c.column_name = need.col
  );

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Veto migration not applied. Missing: %', array_to_string(v_missing, '; ');
  END IF;

  -- A map_choice check under another name would keep rejecting 'veto'
  SELECT conname INTO v_other
  FROM pg_constraint
  WHERE conrelid = 'public.scrims'::regclass
    AND contype = 'c'
    AND conname <> 'scrims_map_choice_check'
    AND pg_get_constraintdef(oid) ILIKE '%map_choice%'
  LIMIT 1;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'Veto migration not applied. scrims has another map_choice check constraint named "%"; drop it first.', v_other;
  END IF;

  IF EXISTS (SELECT 1 FROM public.scrims WHERE map_choice NOT IN ('manual', 'tiered', 'veto')) THEN
    RAISE EXCEPTION 'Veto migration not applied. scrims has rows with a map_choice other than manual/tiered/veto.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_map_choice_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_map_choice_check
CHECK (map_choice IN ('manual', 'tiered', 'veto'));

ALTER TABLE public.scrims
ADD COLUMN IF NOT EXISTS veto_maps TEXT[],
ADD COLUMN IF NOT EXISTS veto_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS veto_resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS veto_tiebreak BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.scrim_players
ADD COLUMN IF NOT EXISTS veto_map_vote TEXT;

COMMENT ON COLUMN public.scrims.map_choice IS
  'manual = creator picked a specific map; tiered = weighted random map assigned when teams are set; veto = players vote between 4 maps drawn from the tiered pool before teams are set';
COMMENT ON COLUMN public.scrims.veto_maps IS
  'veto scrims: the maps offered for the vote';
COMMENT ON COLUMN public.scrims.veto_ends_at IS
  'veto scrims: the vote closes at this time even if not everyone has voted (set when the lobby is first full and ready, or by a map reroll)';
COMMENT ON COLUMN public.scrims.veto_tiebreak IS
  'veto scrims: TRUE when the winning map was picked at random between tied maps';
COMMENT ON COLUMN public.scrim_players.veto_map_vote IS
  'veto scrims: the offered map this player voted for';

-- ---------------------------------------------------------------------------
-- 2) Draw the options (distinct maps, each draw weighted by the tiered pool)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_veto_map_options(
  p_count INTEGER DEFAULT 4,
  p_exclude TEXT[] DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := LEAST(GREATEST(COALESCE(p_count, 4), 1), 10);
  v_exclude TEXT[] := array_remove(COALESCE(p_exclude, ARRAY[]::TEXT[]), NULL);
  v_maps TEXT[] := ARRAY[]::TEXT[];
  v_pick TEXT;
  v_attempts INTEGER := 0;
BEGIN
  -- Draw one at a time and skip repeats, so pick_weighted_tiered_map stays
  -- the only copy of the weights.
  WHILE COALESCE(array_length(v_maps, 1), 0) < v_count AND v_attempts < 2000 LOOP
    v_attempts := v_attempts + 1;
    v_pick := public.pick_weighted_tiered_map(NULL);
    IF v_pick IS NOT NULL AND NOT (v_pick = ANY (v_maps)) AND NOT (v_pick = ANY (v_exclude)) THEN
      v_maps := v_maps || v_pick;
    END IF;
  END LOOP;

  RETURN v_maps;
END;
$$;

COMMENT ON FUNCTION public.pick_veto_map_options(INTEGER, TEXT[]) IS
  'Distinct weighted-random maps from the tiered pool, offered for a veto scrim vote. p_exclude keeps maps out of the draw (used by map reroll).';

-- ---------------------------------------------------------------------------
-- 3) Decide the vote. The app calls this while a veto scrim has no map.
--    Returns the chosen map, or NULL while the vote is still open.
--
--    waiting:     Ready players vote. Nothing is decided until the lobby is
--                 full and everyone is ready (the same rule the app uses to
--                 start a scrim). From then it is decided when everyone has
--                 voted, one map has more than half the players, or 5 minutes
--                 are up. The clock starts once and is not reset by players
--                 un-readying. A decided map is final, and the app only
--                 assigns teams after it.
--    in_progress: Only after a map reroll. Players on a team vote on the new
--                 maps. Decided the same way, or when p_force is set because
--                 the game is being ended.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_map_veto(
  p_scrim_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  v_in_lobby BOOLEAN;
  v_players INTEGER;
  v_ready INTEGER;
  v_voters INTEGER;
  v_votes_cast INTEGER;
  v_top_votes INTEGER;
  v_leaders TEXT[];
  v_winner TEXT;
BEGIN
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND OR v_scrim.map_choice IS DISTINCT FROM 'veto' THEN
    RETURN NULL;
  END IF;

  -- A decided map is final. 'scoring' is here so a game ended at the same
  -- moment as a map reroll still gets a map.
  IF v_scrim.map IS NOT NULL OR v_scrim.status NOT IN ('waiting', 'in_progress', 'scoring') THEN
    RETURN v_scrim.map;
  END IF;

  IF COALESCE(cardinality(v_scrim.veto_maps), 0) = 0 THEN
    v_scrim.veto_maps := public.pick_veto_map_options(4, NULL);
    IF COALESCE(cardinality(v_scrim.veto_maps), 0) = 0 THEN
      RAISE EXCEPTION 'No maps available for the veto vote';
    END IF;
    UPDATE public.scrims SET veto_maps = v_scrim.veto_maps WHERE id = p_scrim_id;
  END IF;

  v_in_lobby := v_scrim.status = 'waiting';

  IF v_in_lobby THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_ready)
    INTO v_players, v_ready
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id;

    IF v_players < GREATEST(v_scrim.min_players_per_team * 2, 8)
       OR v_players % 2 <> 0
       OR v_ready <> v_players THEN
      -- Lobby not full and ready: keep collecting votes
      RETURN NULL;
    END IF;

    IF v_scrim.veto_ends_at IS NULL THEN
      -- Lobby is full and ready for the first time: start the 5 minute
      -- clock and make sure the lobby does not expire before it runs out.
      v_scrim.veto_ends_at := NOW() + INTERVAL '5 minutes';
      UPDATE public.scrims
      SET veto_ends_at = v_scrim.veto_ends_at,
          expires_at = GREATEST(expires_at, v_scrim.veto_ends_at + INTERVAL '2 minutes')
      WHERE id = p_scrim_id;
    END IF;

    v_voters := v_players;
  ELSE
    SELECT COUNT(*) INTO v_voters
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  END IF;

  -- Votes per offered map (0 for maps nobody picked)
  WITH tally AS (
    SELECT o.map_name, COUNT(sp.id) AS votes
    FROM unnest(v_scrim.veto_maps) AS o(map_name)
    LEFT JOIN public.scrim_players sp
      ON sp.scrim_id = p_scrim_id
     AND sp.veto_map_vote = o.map_name
     AND CASE WHEN v_in_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END
    GROUP BY o.map_name
  )
  SELECT
    COALESCE(SUM(votes), 0)::INTEGER,
    COALESCE(MAX(votes), 0)::INTEGER,
    ARRAY(SELECT t.map_name FROM tally t WHERE t.votes = (SELECT MAX(votes) FROM tally) ORDER BY t.map_name)
  INTO v_votes_cast, v_top_votes, v_leaders
  FROM tally;

  IF NOT (
    (COALESCE(p_force, FALSE) AND NOT v_in_lobby)
    OR (v_voters > 0 AND v_votes_cast >= v_voters)
    OR v_top_votes * 2 > v_voters
    OR NOW() >= COALESCE(v_scrim.veto_ends_at, NOW())
  ) THEN
    RETURN NULL;
  END IF;

  -- Tie for first, or no votes at all: random pick between the tied maps
  v_winner := v_leaders[1 + floor(random() * array_length(v_leaders, 1))::INTEGER];

  UPDATE public.scrims
  SET map = v_winner,
      veto_tiebreak = COALESCE(array_length(v_leaders, 1), 0) > 1,
      veto_resolved_at = NOW()
  WHERE id = p_scrim_id;

  RETURN v_winner;
END;
$$;

COMMENT ON FUNCTION public.sync_map_veto(UUID, BOOLEAN) IS
  'Veto scrims: draws the options if missing and sets the map once the vote is decided (lobby full and ready, then all voted / majority / deadline). Ties for first are broken at random and a decided map is final. Returns the map, or NULL while voting is open. No-op for other map choices.';

-- ---------------------------------------------------------------------------
-- 4) Cast / change a vote
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_map_veto_vote(
  p_scrim_id UUID,
  p_user_id TEXT,
  p_map TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  v_player public.scrim_players%ROWTYPE;
BEGIN
  -- Same lock as sync_map_veto, so a vote cannot land after the map is set
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim not found';
  END IF;

  IF v_scrim.map_choice IS DISTINCT FROM 'veto' THEN
    RAISE EXCEPTION 'Map voting is only available for veto scrims';
  END IF;

  IF v_scrim.status NOT IN ('waiting', 'in_progress') OR v_scrim.veto_maps IS NULL THEN
    RAISE EXCEPTION 'Map voting is not open';
  END IF;

  IF v_scrim.map IS NOT NULL THEN
    RAISE EXCEPTION 'Map voting has already finished';
  END IF;

  IF p_map IS NULL OR NOT (p_map = ANY (v_scrim.veto_maps)) THEN
    RAISE EXCEPTION 'That map is not one of the options';
  END IF;

  SELECT * INTO v_player
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not a participant in this scrim';
  END IF;

  IF v_scrim.status = 'waiting' AND NOT v_player.is_ready THEN
    RAISE EXCEPTION 'Ready up to vote for the map';
  END IF;

  IF v_scrim.status = 'in_progress' AND v_player.team IS NULL THEN
    RAISE EXCEPTION 'You must be on a team in this scrim to vote';
  END IF;

  UPDATE public.scrim_players
  SET veto_map_vote = p_map
  WHERE id = v_player.id;

  RETURN public.sync_map_veto(p_scrim_id, FALSE);
END;
$$;

COMMENT ON FUNCTION public.cast_map_veto_vote(UUID, TEXT, TEXT) IS
  'Records a player''s map vote for a veto scrim (ready players while waiting; team players after a map reroll) and closes the vote if it is now decided. Returns the chosen map or NULL.';

-- ---------------------------------------------------------------------------
-- 5) Map reroll for veto scrims: 4 new maps and a new vote.
--    Same voted_map_reroll votes and threshold as the tiered reroll.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_execute_veto_map_reroll(p_scrim_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  total_players INTEGER;
  votes_for_reroll INTEGER;
BEGIN
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_scrim.map_choice IS DISTINCT FROM 'veto'
     OR v_scrim.status IS DISTINCT FROM 'in_progress'
     OR v_scrim.map IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE voted_map_reroll)
  INTO total_players, votes_for_reroll
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  IF votes_for_reroll < (total_players / 2) + 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.scrims
  SET veto_maps = public.pick_veto_map_options(4, v_scrim.veto_maps),
      map = NULL,
      veto_ends_at = NOW() + INTERVAL '5 minutes',
      veto_tiebreak = FALSE,
      veto_resolved_at = NULL
  WHERE id = p_scrim_id;

  UPDATE public.scrim_players
  SET veto_map_vote = NULL,
      voted_map_reroll = FALSE
  WHERE scrim_id = p_scrim_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.check_and_execute_veto_map_reroll(UUID) IS
  'Veto scrims: if the map-reroll vote threshold is met, offers 4 new maps (none of the previous 4) and reopens the vote for 5 minutes. Returns TRUE when a reroll happened.';

-- ---------------------------------------------------------------------------
-- 6) Team reroll for veto scrims: balance by ELO again instead of purely
--    random. Same 100 random splits as assign_elo_optimized_random_teams, but
--    a split equal to the current teams is never picked. Scrims created with
--    random team selection keep the purely random reroll.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_execute_veto_team_reroll(p_scrim_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  total_players INTEGER;
  votes_for_reroll INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_scrim.map_choice IS DISTINCT FROM 'veto'
     OR v_scrim.status IS DISTINCT FROM 'in_progress' THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE voted_reroll)
  INTO total_players, votes_for_reroll
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  IF votes_for_reroll < (total_players / 2) + 1 THEN
    RETURN FALSE;
  END IF;

  IF v_scrim.selection_mode = 'random' THEN
    PERFORM public.assign_purely_random_teams(p_scrim_id);
    RETURN TRUE;
  END IF;

  IF total_players < 2 OR total_players % 2 <> 0 THEN
    RAISE EXCEPTION 'Cannot reroll teams: need an even number of players (got %)', total_players;
  END IF;

  half_count := total_players / 2;

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      sp.team AS current_team,
      COALESCE(pe.elo, 1200)::BIGINT AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.team IS NOT NULL
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  attempts AS (
    SELECT
      gs.attempt_num,
      pe.player_id,
      pe.current_team,
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
      ) AS diff,
      -- same two groups as now (either way round) would not be a reroll
      COUNT(*) FILTER (WHERE rn <= half_count AND current_team = 'team_a') IN (0, half_count) AS same_teams
    FROM attempts
    GROUP BY attempt_num
  ),
  best_attempt AS (
    SELECT attempt_num
    FROM attempt_diffs
    ORDER BY same_teams ASC, diff ASC, attempt_num ASC
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
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  IF team_a_count IS DISTINCT FROM half_count OR team_b_count IS DISTINCT FROM half_count THEN
    RAISE EXCEPTION 'Team reroll failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  UPDATE public.scrim_players
  SET voted_reroll = FALSE
  WHERE scrim_id = p_scrim_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.check_and_execute_veto_team_reroll(UUID) IS
  'Veto scrims: if the team-reroll vote threshold is met, re-balances teams by ELO (purely random for random-selection scrims) and resets the votes. Returns TRUE when a reroll happened.';

GRANT EXECUTE ON FUNCTION public.pick_veto_map_options(INTEGER, TEXT[]) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.sync_map_veto(UUID, BOOLEAN) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.cast_map_veto_vote(UUID, TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_and_execute_veto_map_reroll(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_and_execute_veto_team_reroll(UUID) TO authenticated, service_role, anon;

-- Reload the API schema cache so the new functions can be called right away
NOTIFY pgrst, 'reload schema';

COMMIT;
