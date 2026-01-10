-- Create scrim_score_submissions table
-- Tracks score submissions from players after a scrim ends

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
  
  -- Each user can only submit one score per scrim
  UNIQUE(scrim_id, user_id)
);

-- Indexes
CREATE INDEX idx_scrim_scores_scrim_id ON public.scrim_score_submissions(scrim_id);

-- Enable RLS
ALTER TABLE public.scrim_score_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view score submissions" ON public.scrim_score_submissions
  FOR SELECT USING (true);

CREATE POLICY "Scrim participants can submit scores" ON public.scrim_score_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own submissions" ON public.scrim_score_submissions
  FOR UPDATE USING (true);

COMMENT ON TABLE public.scrim_score_submissions IS 'Score submissions from players after scrim ends';




