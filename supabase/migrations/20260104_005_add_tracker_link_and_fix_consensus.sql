-- Migration: Add tracker session link, map, and change consensus to 2 votes
-- Run this after the initial schema if you've already set up the tables

-- ============================================
-- 1. Add tracker_session_id and map to scrims table
-- ============================================

ALTER TABLE public.scrims 
ADD COLUMN IF NOT EXISTS tracker_session_id TEXT;

ALTER TABLE public.scrims 
ADD COLUMN IF NOT EXISTS map TEXT;

COMMENT ON COLUMN public.scrims.tracker_session_id IS 'Links to /tracker/session/{id} for the game stats';

-- ============================================
-- 2. Update check_score_consensus to require only 2 matching votes
-- ============================================

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
BEGIN
  SELECT COUNT(*) INTO total_players
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id;
  
  -- Changed: Now only requires 2 matching submissions instead of >50%
  RETURN QUERY
  SELECT 
    (COUNT(*) >= 2) as has_consensus,
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

-- ============================================
-- 3. Update the view to include tracker_session_id
-- ============================================

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

-- ============================================
-- 4. Function to get distinct maps from player_stats
-- ============================================

CREATE OR REPLACE FUNCTION get_distinct_maps()
RETURNS TABLE(map TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ps.map
  FROM public.player_stats ps
  WHERE ps.map IS NOT NULL AND ps.map != ''
  ORDER BY ps.map;
END;
$$ LANGUAGE plpgsql;

-- Done!

