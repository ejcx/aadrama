-- King of the Hill: preset-map team matches (1v1 / 2v2 / 3v3) with team ELO

-- ============================================
-- Matches
-- ============================================

CREATE TABLE IF NOT EXISTS public.koth_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  created_by TEXT NOT NULL,
  created_by_name TEXT,

  -- 1 = 1v1, 2 = 2v2, 3 = 3v3
  format INTEGER NOT NULL CHECK (format IN (1, 2, 3)),
  map TEXT NOT NULL,

  team_a_name TEXT NOT NULL DEFAULT 'Team A',
  team_b_name TEXT NOT NULL DEFAULT 'Team B',

  -- Linked after finalize when team ELO is processed
  team_a_id UUID,
  team_b_id UUID,

  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'in_progress', 'scoring', 'finalized', 'expired', 'cancelled')),

  team_a_score INTEGER,
  team_b_score INTEGER,
  winner TEXT CHECK (winner IN ('team_a', 'team_b', 'draw', NULL)),

  elo_processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);

CREATE INDEX idx_koth_matches_status ON public.koth_matches(status);
CREATE INDEX idx_koth_matches_created_at ON public.koth_matches(created_at DESC);
CREATE INDEX idx_koth_matches_format ON public.koth_matches(format);
CREATE INDEX idx_koth_matches_expires_at ON public.koth_matches(expires_at) WHERE status = 'waiting';

ALTER TABLE public.koth_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view koth matches" ON public.koth_matches
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create koth matches" ON public.koth_matches
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update koth matches" ON public.koth_matches
  FOR UPDATE USING (true);

-- ============================================
-- Players
-- ============================================

CREATE TABLE IF NOT EXISTS public.koth_match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.koth_matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('team_a', 'team_b')),
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  UNIQUE(match_id, user_id)
);

CREATE INDEX idx_koth_match_players_match ON public.koth_match_players(match_id);
CREATE INDEX idx_koth_match_players_user ON public.koth_match_players(user_id);

ALTER TABLE public.koth_match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view koth match players" ON public.koth_match_players
  FOR SELECT USING (true);
CREATE POLICY "Users can join koth matches" ON public.koth_match_players
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update koth match players" ON public.koth_match_players
  FOR UPDATE USING (true);
CREATE POLICY "Users can leave koth matches" ON public.koth_match_players
  FOR DELETE USING (true);

-- ============================================
-- Score submissions
-- ============================================

CREATE TABLE IF NOT EXISTS public.koth_score_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.koth_matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT,
  team_a_score INTEGER NOT NULL CHECK (team_a_score >= 0),
  team_b_score INTEGER NOT NULL CHECK (team_b_score >= 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

CREATE INDEX idx_koth_scores_match ON public.koth_score_submissions(match_id);

ALTER TABLE public.koth_score_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view koth scores" ON public.koth_score_submissions
  FOR SELECT USING (true);
CREATE POLICY "Participants can submit koth scores" ON public.koth_score_submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update koth score submissions" ON public.koth_score_submissions
  FOR UPDATE USING (true);

-- ============================================
-- Teams + team ELO (separate boards per format)
-- ============================================

CREATE TABLE IF NOT EXISTS public.koth_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format INTEGER NOT NULL CHECK (format IN (1, 2, 3)),
  -- Sorted Clerk user IDs joined by '|'; identity of the roster for this format
  roster_key TEXT NOT NULL,
  name TEXT NOT NULL,
  member_user_ids TEXT[] NOT NULL,
  member_names TEXT[] NOT NULL DEFAULT '{}',
  elo INTEGER NOT NULL DEFAULT 1200,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(format, roster_key)
);

CREATE INDEX idx_koth_teams_elo ON public.koth_teams(format, elo DESC);
CREATE INDEX idx_koth_teams_members ON public.koth_teams USING GIN (member_user_ids);

ALTER TABLE public.koth_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view koth teams" ON public.koth_teams
  FOR SELECT USING (true);
CREATE POLICY "Users can create koth teams" ON public.koth_teams
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update koth teams" ON public.koth_teams
  FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.koth_elo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.koth_teams(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.koth_matches(id) ON DELETE CASCADE,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  team_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  k_factor INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

CREATE INDEX idx_koth_elo_history_team ON public.koth_elo_history(team_id, created_at DESC);
CREATE INDEX idx_koth_elo_history_match ON public.koth_elo_history(match_id);

ALTER TABLE public.koth_elo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view koth elo history" ON public.koth_elo_history
  FOR SELECT USING (true);
CREATE POLICY "System can insert koth elo history" ON public.koth_elo_history
  FOR INSERT WITH CHECK (true);

-- FK from matches to teams (added after koth_teams exists)
ALTER TABLE public.koth_matches
  ADD CONSTRAINT koth_matches_team_a_id_fkey
  FOREIGN KEY (team_a_id) REFERENCES public.koth_teams(id);
ALTER TABLE public.koth_matches
  ADD CONSTRAINT koth_matches_team_b_id_fkey
  FOREIGN KEY (team_b_id) REFERENCES public.koth_teams(id);

-- ============================================
-- View with counts
-- ============================================

CREATE OR REPLACE VIEW public.koth_matches_with_counts AS
SELECT
  m.*,
  COALESCE(pc.player_count, 0) AS player_count,
  COALESCE(pc.ready_count, 0) AS ready_count,
  COALESCE(pc.team_a_count, 0) AS team_a_count,
  COALESCE(pc.team_b_count, 0) AS team_b_count,
  COALESCE(sc.score_submission_count, 0) AS score_submission_count
FROM public.koth_matches m
LEFT JOIN (
  SELECT
    match_id,
    COUNT(*) AS player_count,
    COUNT(*) FILTER (WHERE is_ready) AS ready_count,
    COUNT(*) FILTER (WHERE team = 'team_a') AS team_a_count,
    COUNT(*) FILTER (WHERE team = 'team_b') AS team_b_count
  FROM public.koth_match_players
  GROUP BY match_id
) pc ON m.id = pc.match_id
LEFT JOIN (
  SELECT match_id, COUNT(*) AS score_submission_count
  FROM public.koth_score_submissions
  GROUP BY match_id
) sc ON m.id = sc.match_id;

-- ============================================
-- Helpers / lifecycle RPCs
-- ============================================

CREATE OR REPLACE FUNCTION expire_stale_koth_matches()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.koth_matches
  SET status = 'expired'
  WHERE status = 'waiting'
    AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_koth_score_consensus(p_match_id UUID)
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
  FROM public.koth_match_players
  WHERE match_id = p_match_id;

  RETURN QUERY
  SELECT
    (COUNT(*) >= 2) AS has_consensus,
    ss.team_a_score AS consensus_team_a_score,
    ss.team_b_score AS consensus_team_b_score,
    COUNT(*)::INTEGER AS submission_count,
    total_players AS player_count
  FROM public.koth_score_submissions ss
  WHERE ss.match_id = p_match_id
  GROUP BY ss.team_a_score, ss.team_b_score
  ORDER BY COUNT(*) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finalize_koth_match(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_consensus RECORD;
  v_winner TEXT;
BEGIN
  SELECT * INTO v_consensus
  FROM check_koth_score_consensus(p_match_id);

  IF v_consensus IS NULL OR NOT v_consensus.has_consensus THEN
    RETURN FALSE;
  END IF;

  IF v_consensus.consensus_team_a_score > v_consensus.consensus_team_b_score THEN
    v_winner := 'team_a';
  ELSIF v_consensus.consensus_team_b_score > v_consensus.consensus_team_a_score THEN
    v_winner := 'team_b';
  ELSE
    v_winner := 'draw';
  END IF;

  UPDATE public.koth_matches
  SET
    status = 'finalized',
    team_a_score = v_consensus.consensus_team_a_score,
    team_b_score = v_consensus.consensus_team_b_score,
    winner = v_winner,
    finalized_at = NOW()
  WHERE id = p_match_id
    AND status = 'scoring';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_koth_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER koth_teams_updated_at
  BEFORE UPDATE ON public.koth_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_koth_teams_updated_at();

COMMENT ON TABLE public.koth_matches IS 'King of the Hill preset-map team matches (1v1/2v2/3v3)';
COMMENT ON TABLE public.koth_teams IS 'Persistent KotH team identity + ELO per format';
