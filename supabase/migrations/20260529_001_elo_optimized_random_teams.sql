-- Skill-based matchmaking: 100 random 50/50 splits, pick lowest |sum(ELO_A) − sum(ELO_B)|.
-- Replaces 50/50 ELO/kills snake draft (20260516_005_skill_based_matchmaking.sql).
-- Logic mirrored in lib/scrim/matchmaking.ts (assignEloOptimizedRandomTeams).

CREATE OR REPLACE FUNCTION assign_elo_optimized_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
  v_attempt INTEGER;
  v_best_diff BIGINT := NULL;
  v_diff BIGINT;
BEGIN
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

  CREATE TEMP TABLE _elo_players (
    player_id UUID PRIMARY KEY,
    elo BIGINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _elo_players (player_id, elo)
  SELECT DISTINCT ON (sp.id)
    sp.id,
    COALESCE(pe.elo, 1200)::BIGINT
  FROM public.scrim_players sp
  LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
  LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
  WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
  ORDER BY sp.id, pe.elo DESC NULLS LAST;

  CREATE TEMP TABLE _trial_shuffle (
    player_id UUID NOT NULL,
    elo BIGINT NOT NULL,
    rn INTEGER NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _best_assignment (
    player_id UUID PRIMARY KEY,
    team TEXT NOT NULL
  ) ON COMMIT DROP;

  FOR v_attempt IN 1..100 LOOP
    DELETE FROM _trial_shuffle;

    INSERT INTO _trial_shuffle (player_id, elo, rn)
    SELECT
      player_id,
      elo,
      ROW_NUMBER() OVER (ORDER BY random()) AS rn
    FROM _elo_players;

    SELECT ABS(
      COALESCE(SUM(elo) FILTER (WHERE rn <= half_count), 0)
      - COALESCE(SUM(elo) FILTER (WHERE rn > half_count), 0)
    )
    INTO v_diff
    FROM _trial_shuffle;

    IF v_best_diff IS NULL OR v_diff < v_best_diff THEN
      v_best_diff := v_diff;
      DELETE FROM _best_assignment;
      INSERT INTO _best_assignment (player_id, team)
      SELECT
        player_id,
        CASE WHEN rn <= half_count THEN 'team_a' ELSE 'team_b' END
      FROM _trial_shuffle;
    END IF;
  END LOOP;

  IF v_best_diff IS NULL THEN
    RAISE EXCEPTION 'Team assignment failed: no valid random split found';
  END IF;

  UPDATE public.scrim_players sp
  SET team = ba.team
  FROM _best_assignment ba
  WHERE sp.id = ba.player_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_skill_based_teams(p_scrim_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM assign_elo_optimized_random_teams(p_scrim_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_elo_optimized_random_teams IS '100 random 50/50 splits; keeps split with smallest |sum(ELO_A) − sum(ELO_B)|';
COMMENT ON FUNCTION assign_skill_based_teams IS 'Skill-based: ELO-optimized random team search (100 trials)';
COMMENT ON FUNCTION assign_kills_balanced_teams IS 'Deprecated: was kills snake draft; skill_based now uses assign_elo_optimized_random_teams';
