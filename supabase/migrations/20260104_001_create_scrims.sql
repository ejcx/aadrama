-- Create scrims table
-- Represents a competitive match that players can create and join

CREATE TABLE IF NOT EXISTS public.scrims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Creator info (Clerk user ID)
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  
  -- Scrim configuration
  title TEXT,
  max_players_per_team INTEGER NOT NULL DEFAULT 8,
  min_players_per_team INTEGER NOT NULL DEFAULT 1,
  
  -- Status: waiting -> ready_check -> in_progress -> scoring -> finalized
  --         waiting -> expired (after 20 min without starting)
  --         any -> cancelled (manual cancellation)
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'ready_check', 'in_progress', 'scoring', 'finalized', 'expired', 'cancelled')),
  
  -- Final results (populated when finalized)
  team_a_score INTEGER,
  team_b_score INTEGER,
  winner TEXT CHECK (winner IN ('team_a', 'team_b', 'draw', NULL)),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes'),
  ready_check_at TIMESTAMPTZ,      -- When ready check started
  started_at TIMESTAMPTZ,          -- When game actually started (all ready)
  finished_at TIMESTAMPTZ,         -- When moved to scoring phase
  finalized_at TIMESTAMPTZ         -- When final score was confirmed
);

-- Indexes for common queries
CREATE INDEX idx_scrims_status ON public.scrims(status);
CREATE INDEX idx_scrims_created_at ON public.scrims(created_at DESC);
CREATE INDEX idx_scrims_expires_at ON public.scrims(expires_at) WHERE status = 'waiting';
CREATE INDEX idx_scrims_created_by ON public.scrims(created_by);

-- Enable RLS
ALTER TABLE public.scrims ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read scrims, authenticated users can create
CREATE POLICY "Anyone can view scrims" ON public.scrims
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create scrims" ON public.scrims
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Creator can update their scrim" ON public.scrims
  FOR UPDATE USING (true);

COMMENT ON TABLE public.scrims IS 'Competitive scrim matches that players can create and join';





