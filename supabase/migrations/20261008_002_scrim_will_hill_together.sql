-- "Will & Hill" option: a scrim created with it ticked always puts Will
-- (Army-=Of-God=-) and Hill (hill) on the same team, at the start and on every
-- team reroll. Everyone else is placed the way the scrim's team selection
-- already works.
--
-- Only adds things: 1 column and 4 functions. No existing function, trigger or
-- view is changed, and scrims without the option never call the new functions.
--
-- To run: paste the whole file into the SQL editor (nothing highlighted) and
-- run it before deploying the app code. It is one transaction, so a failure
-- changes nothing. Safe to run again.
--
-- ROLLBACK_scrim_will_hill_together.sql is the undo script. Do not run it
-- unless you are removing the option.

BEGIN;

-- The ALTER needs a short exclusive lock on scrims. If another query is
-- holding the table, fail after 3 seconds instead of making every scrim page
-- wait. Nothing is changed in that case. Run it again.
SET LOCAL lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 0) Pre-flight: stop with a clear message if something the new functions
--    need is missing. Postgres would not notice until they are called.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regprocedure('public.assign_skill_based_teams(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function assign_skill_based_teams(uuid)');
  END IF;
  IF to_regprocedure('public.assign_random_teams(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function assign_random_teams(uuid)');
  END IF;
  IF to_regprocedure('public.check_and_execute_reroll(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function check_and_execute_reroll(uuid)');
  END IF;
  IF to_regprocedure('public.check_and_execute_veto_team_reroll(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function check_and_execute_veto_team_reroll(uuid) (apply 20261008_001_scrim_map_veto.sql)');
  END IF;
  IF to_regclass('public.user_game_names') IS NULL THEN v_missing := array_append(v_missing, 'table user_game_names'); END IF;
  IF to_regclass('public.player_elo') IS NULL THEN v_missing := array_append(v_missing, 'table player_elo'); END IF;

  SELECT v_missing || COALESCE(array_agg(need.tbl || '.' || need.col), ARRAY[]::TEXT[])
  INTO v_missing
  FROM (VALUES
    ('scrims', 'map_choice'), ('scrims', 'selection_mode'), ('scrims', 'status'), ('scrims', 'started_at'),
    ('scrim_players', 'scrim_id'), ('scrim_players', 'user_id'), ('scrim_players', 'is_ready'),
    ('scrim_players', 'team'), ('scrim_players', 'voted_reroll')
  ) AS need(tbl, col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = need.tbl AND c.column_name = need.col
  );

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Will & Hill migration not applied. Missing: %', array_to_string(v_missing, '; ');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Column
-- ---------------------------------------------------------------------------
ALTER TABLE public.scrims
ADD COLUMN IF NOT EXISTS keep_will_hill_together BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.scrims.keep_will_hill_together IS
  'TRUE = Will (Army-=Of-God=-) and Hill (hill) are always put on the same team, at the start and on team rerolls';

-- ---------------------------------------------------------------------------
-- 2) Who Will and Hill are in a scrim. The two game names live here and
--    nowhere else. Returns their scrim_players ids, or NULL unless both are
--    in the scrim (ready in the lobby, or on a team once it has started).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.will_hill_scrim_player_ids(
  p_scrim_id UUID,
  p_from_lobby BOOLEAN
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_will UUID;
  v_hill UUID;
BEGIN
  SELECT sp.id INTO v_will
  FROM public.scrim_players sp
  JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
  WHERE sp.scrim_id = p_scrim_id
    AND ugn.game_name_lower = 'army-=of-god=-'
    AND CASE WHEN p_from_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END
  LIMIT 1;

  SELECT sp.id INTO v_hill
  FROM public.scrim_players sp
  JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
  WHERE sp.scrim_id = p_scrim_id
    AND ugn.game_name_lower = 'hill'
    AND CASE WHEN p_from_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END
  LIMIT 1;

  IF v_will IS NULL OR v_hill IS NULL OR v_will = v_hill THEN
    RETURN NULL;
  END IF;

  RETURN ARRAY[v_will, v_hill];
END;
$$;

COMMENT ON FUNCTION public.will_hill_scrim_player_ids(UUID, BOOLEAN) IS
  'scrim_players ids of Will (Army-=Of-God=-) and Hill (hill) when both are in the scrim, else NULL. Matched through their linked game names.';

-- ---------------------------------------------------------------------------
-- 3) Split the players 50/50 with the pair on the same team.
--    100 random splits that all keep the pair together, the same search as
--    assign_elo_optimized_random_teams.
--      p_balance TRUE:  keep the split with the smallest ELO gap
--      p_balance FALSE: keep a random one (same as assign_purely_random_teams)
--    On a reroll (p_from_lobby FALSE) a split equal to the current teams is
--    never picked. Does not touch scrims.status or the reroll votes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.split_teams_keeping_pair(
  p_scrim_id UUID,
  p_pair UUID[],
  p_from_lobby BOOLEAN,
  p_balance BOOLEAN
)
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
  pair_teams INTEGER;
BEGIN
  IF p_pair IS NULL OR cardinality(p_pair) <> 2 THEN
    RAISE EXCEPTION 'Cannot assign teams: the pair to keep together is not in the scrim';
  END IF;

  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players sp
  WHERE sp.scrim_id = p_scrim_id
    AND CASE WHEN p_from_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END;

  IF player_count < 4 OR player_count % 2 <> 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: need an even number of players, at least 4 (got %)', player_count;
  END IF;

  half_count := player_count / 2;

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      sp.team AS current_team,
      (sp.id = ANY (p_pair)) AS in_pair,
      COALESCE(pe.elo, 1200)::BIGINT AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id
      AND CASE WHEN p_from_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  -- one coin flip per attempt: which team the pair's half becomes
  trials AS MATERIALIZED (
    SELECT gs.attempt_num, random() < 0.5 AS pair_on_a
    FROM generate_series(1, 100) AS gs(attempt_num)
  ),
  -- the pair is always ranked 1 and 2, so it is always in the first half
  attempts AS MATERIALIZED (
    SELECT
      t.attempt_num,
      t.pair_on_a,
      pe.player_id,
      pe.current_team,
      pe.elo,
      ROW_NUMBER() OVER (PARTITION BY t.attempt_num ORDER BY pe.in_pair DESC, random()) AS rn
    FROM player_elos pe
    CROSS JOIN trials t
  ),
  attempt_diffs AS (
    SELECT
      attempt_num,
      ABS(
        COALESCE(SUM(elo) FILTER (WHERE rn <= half_count), 0)
        - COALESCE(SUM(elo) FILTER (WHERE rn > half_count), 0)
      ) AS diff,
      -- same two groups as now (either way round) would not be a reroll
      (NOT p_from_lobby)
        AND COUNT(*) FILTER (WHERE rn <= half_count AND current_team = 'team_a') IN (0, half_count) AS same_teams
    FROM attempts
    GROUP BY attempt_num
  ),
  best_attempt AS (
    SELECT attempt_num
    FROM attempt_diffs
    ORDER BY same_teams ASC, (CASE WHEN p_balance THEN diff ELSE 0 END) ASC, attempt_num ASC
    LIMIT 1
  ),
  best_teams AS (
    SELECT
      a.player_id,
      CASE WHEN (a.rn <= half_count) = a.pair_on_a THEN 'team_a' ELSE 'team_b' END AS team
    FROM attempts a
    INNER JOIN best_attempt b ON a.attempt_num = b.attempt_num
  )
  UPDATE public.scrim_players sp
  SET team = bt.team
  FROM best_teams bt
  WHERE sp.id = bt.player_id;

  SELECT
    COUNT(*) FILTER (WHERE sp.team = 'team_a'),
    COUNT(*) FILTER (WHERE sp.team = 'team_b'),
    COUNT(DISTINCT sp.team) FILTER (WHERE sp.id = ANY (p_pair))
  INTO team_a_count, team_b_count, pair_teams
  FROM public.scrim_players sp
  WHERE sp.scrim_id = p_scrim_id
    AND CASE WHEN p_from_lobby THEN sp.is_ready ELSE sp.team IS NOT NULL END;

  IF team_a_count IS DISTINCT FROM half_count OR team_b_count IS DISTINCT FROM half_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  IF pair_teams IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Team assignment failed: Will and Hill are not on the same team';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.split_teams_keeping_pair(UUID, UUID[], BOOLEAN, BOOLEAN) IS
  'Splits a scrim''s players 50/50 with the two given scrim_players on the same team. Best ELO balance of 100 random splits (p_balance) or a random split. Rerolls never return the current teams.';

-- ---------------------------------------------------------------------------
-- 4) Start a scrim that has the option ticked (Skill Based or Random).
--    Called by the app instead of assign_skill_based_teams/assign_random_teams.
--      Will and Hill not both in the scrim: exactly the normal assignment.
--      Skill Based: best ELO balance among splits that keep them together.
--      Random:      the normal assign_random_teams, then if they were split,
--                   one of them swaps with a player from the other team (the
--                   swap that leaves the smallest ELO gap).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_will_hill_teams(p_scrim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  v_pair UUID[];
  v_ready INTEGER;
  v_skill_based BOOLEAN;
  v_pair_teams INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim not found';
  END IF;

  -- Already started (another request got here first): nothing to do
  IF v_scrim.status <> 'waiting' THEN
    RETURN;
  END IF;

  -- Captains pick their own teams; the app never ticks the option for them
  IF v_scrim.selection_mode = 'captains' THEN
    RAISE EXCEPTION 'Will & Hill is not available for captains pick scrims';
  END IF;

  v_skill_based := v_scrim.selection_mode IN ('skill_based', 'elo_balanced');
  v_pair := public.will_hill_scrim_player_ids(p_scrim_id, TRUE);

  IF v_pair IS NULL OR NOT v_scrim.keep_will_hill_together THEN
    IF v_skill_based THEN
      PERFORM public.assign_skill_based_teams(p_scrim_id);
    ELSE
      PERFORM public.assign_random_teams(p_scrim_id);
    END IF;
    RETURN;
  END IF;

  IF v_skill_based THEN
    SELECT COUNT(*) INTO v_ready
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

    IF v_ready < 8 THEN
      RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', v_ready;
    END IF;

    PERFORM public.split_teams_keeping_pair(p_scrim_id, v_pair, TRUE, TRUE);

    UPDATE public.scrims
    SET status = 'in_progress',
        started_at = NOW()
    WHERE id = p_scrim_id AND status = 'waiting';

    RETURN;
  END IF;

  -- Random: normal assignment first (it also starts the scrim)
  PERFORM public.assign_random_teams(p_scrim_id);

  SELECT COUNT(DISTINCT team) INTO v_pair_teams
  FROM public.scrim_players
  WHERE id = ANY (v_pair) AND team IS NOT NULL;

  IF v_pair_teams = 2 THEN
    WITH player_elos AS (
      SELECT DISTINCT ON (sp.id)
        sp.id AS player_id,
        sp.team,
        (sp.id = ANY (v_pair)) AS in_pair,
        COALESCE(pe.elo, 1200)::BIGINT AS elo
      FROM public.scrim_players sp
      LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
      LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
      WHERE sp.scrim_id = p_scrim_id AND sp.team IS NOT NULL
      ORDER BY sp.id, pe.elo DESC NULLS LAST
    ),
    totals AS (
      SELECT
        COALESCE(SUM(elo) FILTER (WHERE team = 'team_a'), 0)
        - COALESCE(SUM(elo) FILTER (WHERE team = 'team_b'), 0) AS gap
      FROM player_elos
    ),
    -- every swap that reunites them: Will or Hill trades places with a
    -- player (not the other one of the pair) on the other team
    best_swap AS (
      SELECT
        m.player_id AS mover_id,
        m.team AS mover_team,
        s.player_id AS swap_id,
        s.team AS swap_team
      FROM player_elos m
      INNER JOIN player_elos s ON s.team <> m.team AND NOT s.in_pair
      CROSS JOIN totals t
      WHERE m.in_pair
      ORDER BY
        ABS(t.gap - 2 * (CASE WHEN m.team = 'team_a' THEN 1 ELSE -1 END) * (m.elo - s.elo)) ASC,
        random()
      LIMIT 1
    )
    UPDATE public.scrim_players sp
    SET team = CASE WHEN sp.id = bs.mover_id THEN bs.swap_team ELSE bs.mover_team END
    FROM best_swap bs
    WHERE sp.id IN (bs.mover_id, bs.swap_id);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b'),
    COUNT(DISTINCT team) FILTER (WHERE id = ANY (v_pair))
  INTO team_a_count, team_b_count, v_pair_teams
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  IF team_a_count IS DISTINCT FROM team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  IF v_pair_teams IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Team assignment failed: Will and Hill are not on the same team';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assign_will_hill_teams(UUID) IS
  'Starts a scrim with keep_will_hill_together: normal team assignment for the scrim''s selection mode, with Will and Hill on the same team when both are playing.';

-- ---------------------------------------------------------------------------
-- 5) Team reroll for a scrim that has the option ticked.
--    Called by the app instead of check_and_execute_reroll /
--    check_and_execute_veto_team_reroll. Same votes and threshold.
--      Will and Hill not both playing: exactly the normal reroll.
--      Otherwise the same kind of reroll, with them kept together:
--        veto scrims (not Random selection): balanced by ELO again
--        everything else:                    purely random
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_execute_will_hill_team_reroll(p_scrim_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim public.scrims%ROWTYPE;
  v_pair UUID[];
  total_players INTEGER;
  votes_for_reroll INTEGER;
BEGIN
  SELECT * INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id
  FOR UPDATE;

  IF NOT FOUND OR v_scrim.status IS DISTINCT FROM 'in_progress' THEN
    RETURN FALSE;
  END IF;

  v_pair := public.will_hill_scrim_player_ids(p_scrim_id, FALSE);

  IF v_pair IS NULL
     OR NOT v_scrim.keep_will_hill_together
     OR v_scrim.selection_mode IS NOT DISTINCT FROM 'captains' THEN
    IF v_scrim.map_choice = 'veto' THEN
      RETURN public.check_and_execute_veto_team_reroll(p_scrim_id);
    END IF;
    RETURN public.check_and_execute_reroll(p_scrim_id);
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE voted_reroll)
  INTO total_players, votes_for_reroll
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

  IF votes_for_reroll < (total_players / 2) + 1 THEN
    RETURN FALSE;
  END IF;

  PERFORM public.split_teams_keeping_pair(
    p_scrim_id,
    v_pair,
    FALSE,
    v_scrim.map_choice = 'veto' AND v_scrim.selection_mode IS DISTINCT FROM 'random'
  );

  UPDATE public.scrim_players
  SET voted_reroll = FALSE
  WHERE scrim_id = p_scrim_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.check_and_execute_will_hill_team_reroll(UUID) IS
  'Scrims with keep_will_hill_together: if the team-reroll vote threshold is met, rerolls teams the way the scrim normally would (ELO-balanced for veto, random otherwise) with Will and Hill kept on the same team. Returns TRUE when a reroll happened.';

-- split_teams_keeping_pair is only called by the two functions above (they
-- run as the owner), so it is not callable through the API.
REVOKE EXECUTE ON FUNCTION public.split_teams_keeping_pair(UUID, UUID[], BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.will_hill_scrim_player_ids(UUID, BOOLEAN) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.assign_will_hill_teams(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.check_and_execute_will_hill_team_reroll(UUID) TO authenticated, service_role, anon;

-- Reload the API schema cache so the new column and functions work right away
NOTIFY pgrst, 'reload schema';

COMMIT;
