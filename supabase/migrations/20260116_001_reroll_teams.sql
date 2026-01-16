-- Add reroll voting functionality for teams
-- Players can vote to reroll teams if they think the matchup is unfair
-- Requires (total_players / 2) + 1 votes to trigger a reroll
-- Rerolled teams are purely random (not ELO-balanced)

-- Add voted_reroll column to track who has voted for a reroll
ALTER TABLE public.scrim_players
ADD COLUMN IF NOT EXISTS voted_reroll BOOLEAN NOT NULL DEFAULT FALSE;

-- Function to purely randomly assign teams (no ELO balancing)
-- Used when teams are rerolled
CREATE OR REPLACE FUNCTION assign_purely_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  -- Get count of players in the scrim (they should all have teams already)
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  -- Must have even number of players
  IF player_count < 2 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 2 players, got %', player_count;
  END IF;
  
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;
  
  half_count := player_count / 2;
  
  -- Randomly assign teams using ORDER BY random()
  WITH shuffled AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id AND team IS NOT NULL
  )
  UPDATE public.scrim_players sp
  SET team = CASE 
    WHEN s.rn <= half_count THEN 'team_a'
    ELSE 'team_b'
  END
  FROM shuffled s
  WHERE sp.id = s.id;
  
  -- Verify teams are even (safety check)
  SELECT 
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;
  
  -- Reset all reroll votes after successful reroll
  UPDATE public.scrim_players
  SET voted_reroll = FALSE
  WHERE scrim_id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if reroll threshold is met and execute reroll
-- Returns true if reroll was executed, false otherwise
CREATE OR REPLACE FUNCTION check_and_execute_reroll(p_scrim_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_players INTEGER;
  votes_for_reroll INTEGER;
  votes_needed INTEGER;
BEGIN
  -- Get total player count
  SELECT COUNT(*) INTO total_players
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  -- Get votes for reroll
  SELECT COUNT(*) INTO votes_for_reroll
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND voted_reroll = TRUE;
  
  -- Calculate votes needed: (total / 2) + 1
  -- For 8 players: 5 votes needed
  -- For 6 players: 4 votes needed
  -- For 4 players: 3 votes needed
  votes_needed := (total_players / 2) + 1;
  
  -- Check if threshold is met
  IF votes_for_reroll >= votes_needed THEN
    -- Execute reroll with purely random teams
    PERFORM assign_purely_random_teams(p_scrim_id);
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get reroll vote status
CREATE OR REPLACE FUNCTION get_reroll_status(p_scrim_id UUID)
RETURNS TABLE(
  total_players INTEGER,
  votes_for_reroll INTEGER,
  votes_needed INTEGER,
  can_reroll BOOLEAN
) AS $$
DECLARE
  total INTEGER;
  votes INTEGER;
  needed INTEGER;
BEGIN
  -- Get total player count
  SELECT COUNT(*) INTO total
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  -- Get votes for reroll
  SELECT COUNT(*) INTO votes
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND voted_reroll = TRUE;
  
  -- Calculate votes needed: (total / 2) + 1
  needed := (total / 2) + 1;
  
  RETURN QUERY SELECT total, votes, needed, (votes >= needed);
END;
$$ LANGUAGE plpgsql;

-- Update the scrims_with_counts view to include reroll information
DROP VIEW IF EXISTS public.scrims_with_counts;

CREATE VIEW public.scrims_with_counts AS
SELECT 
  s.*,
  COALESCE(pc.player_count, 0) as player_count,
  COALESCE(pc.ready_count, 0) as ready_count,
  COALESCE(pc.reroll_votes, 0) as reroll_votes,
  COALESCE(sc.score_submission_count, 0) as score_submission_count
FROM public.scrims s
LEFT JOIN (
  SELECT 
    scrim_id,
    COUNT(*) as player_count,
    COUNT(*) FILTER (WHERE is_ready) as ready_count,
    COUNT(*) FILTER (WHERE voted_reroll) as reroll_votes
  FROM public.scrim_players
  GROUP BY scrim_id
) pc ON s.id = pc.scrim_id
LEFT JOIN (
  SELECT scrim_id, COUNT(*) as score_submission_count
  FROM public.scrim_score_submissions
  GROUP BY scrim_id
) sc ON s.id = sc.scrim_id;

COMMENT ON FUNCTION assign_purely_random_teams IS 'Assigns teams purely randomly without ELO balancing - used for rerolls';
COMMENT ON FUNCTION check_and_execute_reroll IS 'Checks if reroll vote threshold is met and executes reroll if so';
COMMENT ON FUNCTION get_reroll_status IS 'Returns current reroll voting status for a scrim';
