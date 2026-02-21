-- Enforce minimum 8 players (4v4) for team assignment
CREATE OR REPLACE FUNCTION assign_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  -- Get count of ready players
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  -- Must have at least 8 players (4v4 minimum)
  IF player_count < 8 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', player_count;
  END IF;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;

  half_count := player_count / 2;

  -- Assign teams using ELO-balanced snake draft
  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id as player_id,
      sp.user_id,
      COALESCE(pe.elo, 1200) as elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON sp.user_id = ugn.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  ranked_players AS (
    SELECT
      player_id,
      elo,
      ROW_NUMBER() OVER (ORDER BY elo DESC, random()) as rank
    FROM player_elos
  ),
  team_assignments AS (
    SELECT
      player_id,
      elo,
      rank,
      CASE
        WHEN ((rank - 1) / 2) % 2 = 0 THEN
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
        ELSE
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
      END as team
    FROM ranked_players
  )
  UPDATE public.scrim_players sp
  SET team = ta.team
  FROM team_assignments ta
  WHERE sp.id = ta.player_id;

  -- Verify teams are even
  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  -- Update scrim status to in_progress
  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_balanced_teams IS 'Assigns teams balanced by ELO using snake draft - requires minimum 8 players (4v4)';
