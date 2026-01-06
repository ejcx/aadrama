-- Create scrim_players table
-- Tracks players who have joined a scrim's waiting room

CREATE TABLE IF NOT EXISTS public.scrim_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  scrim_id UUID NOT NULL REFERENCES public.scrims(id) ON DELETE CASCADE,
  
  -- Player info (Clerk user ID)
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  
  -- Ready status for ready-check phase
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Team assignment (null while in waiting room, assigned when game starts)
  -- team_a = "attackers" / team_b = "defenders" (or however the game calls them)
  team TEXT CHECK (team IN ('team_a', 'team_b', NULL)),
  
  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ,
  
  -- Each user can only join a scrim once
  UNIQUE(scrim_id, user_id)
);

-- Indexes
CREATE INDEX idx_scrim_players_scrim_id ON public.scrim_players(scrim_id);
CREATE INDEX idx_scrim_players_user_id ON public.scrim_players(user_id);
CREATE INDEX idx_scrim_players_scrim_team ON public.scrim_players(scrim_id, team);

-- Enable RLS
ALTER TABLE public.scrim_players ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view scrim players" ON public.scrim_players
  FOR SELECT USING (true);

CREATE POLICY "Users can join scrims" ON public.scrim_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own ready status" ON public.scrim_players
  FOR UPDATE USING (true);

CREATE POLICY "Users can leave scrims" ON public.scrim_players
  FOR DELETE USING (true);

COMMENT ON TABLE public.scrim_players IS 'Players registered for a scrim waiting room';


