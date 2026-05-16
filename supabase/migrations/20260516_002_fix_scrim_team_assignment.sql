-- Ensure scrim team assignment is always even (no hill/will or other special cases).
-- Replaces any stale DB functions from earlier punitive matchmaking.
--
-- Snake-draft rank logic is tested in lib/scrim/matchmaking.test.ts — keep SQL CASE in sync.
-- Skill-based (50% ELO / 50% kills): see 20260516_005_skill_based_matchmaking.sql

CREATE OR REPLACE FUNCTION assign_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF player_count < 8 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', player_count;
  END IF;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      COALESCE(pe.elo, 1200) AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON sp.user_id = ugn.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  ranked_players AS (
    SELECT
      player_id,
      ROW_NUMBER() OVER (ORDER BY elo DESC, random()) AS rank
    FROM player_elos
  ),
  team_assignments AS (
    SELECT
      player_id,
      CASE
        WHEN ((rank - 1) / 2) % 2 = 0 THEN
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
        ELSE
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
      END AS team
    FROM ranked_players
  )
  UPDATE public.scrim_players sp
  SET team = ta.team
  FROM team_assignments ta
  WHERE sp.id = ta.player_id;

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

CREATE OR REPLACE FUNCTION assign_elo_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
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

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      COALESCE(pe.elo, 1200) AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON sp.user_id = ugn.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  ranked_players AS (
    SELECT
      player_id,
      ROW_NUMBER() OVER (ORDER BY elo DESC, random()) AS rn
    FROM player_elos
  )
  UPDATE public.scrim_players sp
  SET team = CASE
    WHEN ((rp.rn - 1) / 2) % 2 = 0 THEN
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
    ELSE
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
    END
  FROM ranked_players rp
  WHERE sp.id = rp.player_id;

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

CREATE OR REPLACE FUNCTION assign_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM assign_balanced_teams(p_scrim_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_balanced_teams IS 'ELO snake-draft teams; requires 8+ ready players; always 50/50 split';
COMMENT ON FUNCTION assign_elo_balanced_teams IS 'ELO snake-draft teams (default mode); requires 8+ ready players; always 50/50 split';
COMMENT ON FUNCTION assign_random_teams IS 'Legacy name; uses assign_balanced_teams (ELO snake draft)';
