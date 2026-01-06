-- Helper functions for scrim management

-- Function to expire old scrims that haven't started
-- Call this periodically (e.g., via pg_cron or edge function)
CREATE OR REPLACE FUNCTION expire_stale_scrims()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.scrims
  SET status = 'expired'
  WHERE status = 'waiting'
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to randomly assign teams when ready check completes
-- Takes players and splits them evenly into team_a and team_b
CREATE OR REPLACE FUNCTION assign_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
BEGIN
  -- Get count of ready players
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;
  
  -- Must have even number of players
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)' , player_count;
  END IF;
  
  half_count := player_count / 2;
  
  -- Randomly assign half to team_a, half to team_b
  WITH shuffled AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id AND is_ready = TRUE
  )
  UPDATE public.scrim_players sp
  SET team = CASE 
    WHEN s.rn <= half_count THEN 'team_a'
    ELSE 'team_b'
  END
  FROM shuffled s
  WHERE sp.id = s.id;
  
  -- Update scrim status to in_progress
  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if score consensus is reached (>50% agreement)
-- Returns the consensus score if reached, null otherwise
CREATE OR REPLACE FUNCTION check_score_consensus(p_scrim_id UUID)
RETURNS TABLE(
  has_consensus BOOLEAN,
  consensus_team_a_score INTEGER,
  consensus_team_b_score INTEGER,
  submission_count INTEGER,
  player_count INTEGER
) AS $$
DECLARE
  total_players INTEGER;
  required_votes INTEGER;
BEGIN
  -- Get total player count for this scrim
  SELECT COUNT(*) INTO total_players
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id;
  
  -- Need more than 50% agreement
  required_votes := (total_players / 2) + 1;
  
  -- Find the most common score submission
  RETURN QUERY
  SELECT 
    (COUNT(*) >= required_votes) as has_consensus,
    ss.team_a_score as consensus_team_a_score,
    ss.team_b_score as consensus_team_b_score,
    COUNT(*)::INTEGER as submission_count,
    total_players as player_count
  FROM public.scrim_score_submissions ss
  WHERE ss.scrim_id = p_scrim_id
  GROUP BY ss.team_a_score, ss.team_b_score
  ORDER BY COUNT(*) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to finalize a scrim with the consensus score
CREATE OR REPLACE FUNCTION finalize_scrim(p_scrim_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  consensus RECORD;
  winner_val TEXT;
BEGIN
  -- Check for consensus
  SELECT * INTO consensus
  FROM check_score_consensus(p_scrim_id);
  
  IF NOT consensus.has_consensus THEN
    RETURN FALSE;
  END IF;
  
  -- Determine winner
  IF consensus.consensus_team_a_score > consensus.consensus_team_b_score THEN
    winner_val := 'team_a';
  ELSIF consensus.consensus_team_b_score > consensus.consensus_team_a_score THEN
    winner_val := 'team_b';
  ELSE
    winner_val := 'draw';
  END IF;
  
  -- Update scrim with final results
  UPDATE public.scrims
  SET status = 'finalized',
      team_a_score = consensus.consensus_team_a_score,
      team_b_score = consensus.consensus_team_b_score,
      winner = winner_val,
      finalized_at = NOW()
  WHERE id = p_scrim_id
    AND status = 'scoring';
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View for active scrims with player counts
CREATE OR REPLACE VIEW public.scrims_with_counts AS
SELECT 
  s.*,
  COALESCE(pc.player_count, 0) as player_count,
  COALESCE(pc.ready_count, 0) as ready_count,
  COALESCE(sc.score_submission_count, 0) as score_submission_count
FROM public.scrims s
LEFT JOIN (
  SELECT 
    scrim_id,
    COUNT(*) as player_count,
    COUNT(*) FILTER (WHERE is_ready) as ready_count
  FROM public.scrim_players
  GROUP BY scrim_id
) pc ON s.id = pc.scrim_id
LEFT JOIN (
  SELECT scrim_id, COUNT(*) as score_submission_count
  FROM public.scrim_score_submissions
  GROUP BY scrim_id
) sc ON s.id = sc.scrim_id;

COMMENT ON FUNCTION expire_stale_scrims IS 'Marks scrims as expired if they exceed their expiration time';
COMMENT ON FUNCTION assign_random_teams IS 'Randomly assigns ready players to team_a and team_b';
COMMENT ON FUNCTION check_score_consensus IS 'Checks if >50% of players submitted the same score';
COMMENT ON FUNCTION finalize_scrim IS 'Finalizes a scrim if score consensus is reached';



