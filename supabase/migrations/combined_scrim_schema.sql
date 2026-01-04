-- Combined Scrim System Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/jzjixfvadyvftpbuvxqs/sql/new

-- ============================================
-- 1. SCRIMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.scrims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Creator info (Clerk user ID)
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  
  -- Scrim configuration
  title TEXT,
  map TEXT,
  max_players_per_team INTEGER NOT NULL DEFAULT 8,
  min_players_per_team INTEGER NOT NULL DEFAULT 1,
  
  -- Status: waiting -> ready_check -> in_progress -> scoring -> finalized
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready_check', 'in_progress', 'scoring', 'finalized', 'expired', 'cancelled')),
  
  -- Final results (populated when finalized)
  team_a_score INTEGER,
  team_b_score INTEGER,
  winner TEXT CHECK (winner IN ('team_a', 'team_b', 'draw', NULL)),
  
  -- Link to tracker session for game stats
  tracker_session_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes'),
  ready_check_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scrims_status ON public.scrims(status);
CREATE INDEX IF NOT EXISTS idx_scrims_created_at ON public.scrims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrims_expires_at ON public.scrims(expires_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_scrims_created_by ON public.scrims(created_by);

-- ============================================
-- 2. SCRIM PLAYERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.scrim_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  scrim_id UUID NOT NULL REFERENCES public.scrims(id) ON DELETE CASCADE,
  
  -- Player info (Clerk user ID)
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  
  -- Ready status
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Team assignment (null while in waiting room)
  team TEXT CHECK (team IN ('team_a', 'team_b', NULL)),
  
  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  
  UNIQUE(scrim_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scrim_players_scrim_id ON public.scrim_players(scrim_id);
CREATE INDEX IF NOT EXISTS idx_scrim_players_user_id ON public.scrim_players(user_id);
CREATE INDEX IF NOT EXISTS idx_scrim_players_scrim_team ON public.scrim_players(scrim_id, team);

-- ============================================
-- 3. SCRIM SCORE SUBMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.scrim_score_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  scrim_id UUID NOT NULL REFERENCES public.scrims(id) ON DELETE CASCADE,
  
  -- Submitter info
  user_id TEXT NOT NULL,
  user_name TEXT,
  
  -- Submitted scores
  team_a_score INTEGER NOT NULL CHECK (team_a_score >= 0),
  team_b_score INTEGER NOT NULL CHECK (team_b_score >= 0),
  
  -- Timestamp
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(scrim_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_scrim_scores_scrim_id ON public.scrim_score_submissions(scrim_id);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Expire stale scrims
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

-- Randomly assign teams
CREATE OR REPLACE FUNCTION assign_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;
  
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)' , player_count;
  END IF;
  
  half_count := player_count / 2;
  
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
  
  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- Check score consensus (requires 2 matching submissions)
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
  
  -- Requires only 2 matching submissions for consensus
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

-- Finalize scrim
CREATE OR REPLACE FUNCTION finalize_scrim(p_scrim_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  consensus RECORD;
  winner_val TEXT;
BEGIN
  SELECT * INTO consensus
  FROM check_score_consensus(p_scrim_id);
  
  IF NOT consensus.has_consensus THEN
    RETURN FALSE;
  END IF;
  
  IF consensus.consensus_team_a_score > consensus.consensus_team_b_score THEN
    winner_val := 'team_a';
  ELSIF consensus.consensus_team_b_score > consensus.consensus_team_a_score THEN
    winner_val := 'team_b';
  ELSE
    winner_val := 'draw';
  END IF;
  
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

-- ============================================
-- 5. VIEW FOR SCRIMS WITH COUNTS
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
-- 6. HELPER FUNCTION FOR DISTINCT MAPS
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

-- ============================================
-- DONE! Tables and functions created.
-- ============================================

