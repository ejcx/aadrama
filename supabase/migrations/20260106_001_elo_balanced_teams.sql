-- Replace random team assignment with ELO-balanced assignment
-- Uses snake draft: sort by ELO, then alternate picks (1-A, 2-B, 3-B, 4-A, 5-A, 6-B, etc.)
-- This creates balanced teams where the sum of ELOs is roughly equal

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
  
  -- Must have even number of players (minimum 2)
  IF player_count < 2 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 2 players, got %', player_count;
  END IF;
  
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;
  
  half_count := player_count / 2;
  
  -- Assign teams using ELO-balanced snake draft
  -- 1. Get each player's ELO via their linked game name
  -- 2. Sort by ELO descending
  -- 3. Use snake draft pattern: positions 1,4,5,8,9... go to team_a, positions 2,3,6,7,10,11... go to team_b
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
      -- Snake draft pattern: 1-A, 2-B, 3-B, 4-A, 5-A, 6-B, 7-B, 8-A...
      -- Pair 0 (ranks 1,2): A, B
      -- Pair 1 (ranks 3,4): B, A
      -- Pair 2 (ranks 5,6): A, B
      -- etc.
      CASE 
        WHEN ((rank - 1) / 2) % 2 = 0 THEN
          -- Forward pair: first goes A, second goes B
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
        ELSE
          -- Reverse pair: first goes B, second goes A
          CASE WHEN (rank - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
      END as team
    FROM ranked_players
  )
  UPDATE public.scrim_players sp
  SET team = ta.team
  FROM team_assignments ta
  WHERE sp.id = ta.player_id;
  
  -- Verify teams are even (safety check)
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

-- Replace the old assign_random_teams function to use balanced assignment
CREATE OR REPLACE FUNCTION assign_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Now calls the balanced version instead
  PERFORM assign_balanced_teams(p_scrim_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_balanced_teams IS 'Assigns teams balanced by ELO using snake draft (1-A, 2-B, 3-B, 4-A pattern)';
COMMENT ON FUNCTION assign_random_teams IS 'Legacy function name - now uses ELO-balanced assignment';

