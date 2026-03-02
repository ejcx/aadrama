-- Migration: Add captains pick mode for scrims
-- Date: 2026-03-01

-- Add new columns to scrims table for captains pick
ALTER TABLE public.scrims
ADD COLUMN IF NOT EXISTS selection_mode TEXT NOT NULL DEFAULT 'random'
  CHECK (selection_mode IN ('random', 'captains')),
ADD COLUMN IF NOT EXISTS captain_a_user_id TEXT,
ADD COLUMN IF NOT EXISTS captain_a_name TEXT,
ADD COLUMN IF NOT EXISTS captain_b_user_id TEXT,
ADD COLUMN IF NOT EXISTS captain_b_name TEXT,
ADD COLUMN IF NOT EXISTS current_drafter TEXT CHECK (current_drafter IN ('captain_a', 'captain_b', NULL)),
ADD COLUMN IF NOT EXISTS draft_position INTEGER DEFAULT 0;

-- Update status check to include 'drafting' status
ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_status_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_status_check
CHECK (status IN ('waiting', 'ready_check', 'drafting', 'in_progress', 'scoring', 'finalized', 'expired', 'cancelled'));

-- Create function to start captain draft (called when all players ready in captains mode)
CREATE OR REPLACE FUNCTION start_captain_draft(p_scrim_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify captains are set
  IF NOT EXISTS (
    SELECT 1 FROM public.scrims
    WHERE id = p_scrim_id
    AND captain_a_user_id IS NOT NULL
    AND captain_b_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Both captains must be set before starting draft';
  END IF;

  -- Move to drafting status
  UPDATE public.scrims
  SET status = 'drafting',
      current_drafter = 'captain_a',
      draft_position = 0,
      ready_check_at = NOW()
  WHERE id = p_scrim_id AND status = 'waiting';

  -- Assign captains to their teams
  UPDATE public.scrim_players
  SET team = 'team_a'
  WHERE scrim_id = p_scrim_id
  AND user_id = (SELECT captain_a_user_id FROM public.scrims WHERE id = p_scrim_id);

  UPDATE public.scrim_players
  SET team = 'team_b'
  WHERE scrim_id = p_scrim_id
  AND user_id = (SELECT captain_b_user_id FROM public.scrims WHERE id = p_scrim_id);
END;
$$ LANGUAGE plpgsql;

-- Create function to pick a player during draft
CREATE OR REPLACE FUNCTION draft_pick_player(
  p_scrim_id UUID,
  p_captain_user_id TEXT,
  p_picked_user_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_current_drafter TEXT;
  v_captain_a_id TEXT;
  v_captain_b_id TEXT;
  v_draft_position INTEGER;
  v_team TEXT;
  v_total_players INTEGER;
  v_assigned_players INTEGER;
BEGIN
  -- Get scrim info
  SELECT current_drafter, captain_a_user_id, captain_b_user_id, draft_position
  INTO v_current_drafter, v_captain_a_id, v_captain_b_id, v_draft_position
  FROM public.scrims
  WHERE id = p_scrim_id AND status = 'drafting';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim not in drafting status';
  END IF;

  -- Verify it's the captain's turn
  IF (v_current_drafter = 'captain_a' AND p_captain_user_id != v_captain_a_id) OR
     (v_current_drafter = 'captain_b' AND p_captain_user_id != v_captain_b_id) THEN
    RAISE EXCEPTION 'Not your turn to draft';
  END IF;

  -- Determine which team the captain is drafting for
  v_team := CASE
    WHEN v_current_drafter = 'captain_a' THEN 'team_a'
    ELSE 'team_b'
  END;

  -- Assign player to team
  UPDATE public.scrim_players
  SET team = v_team
  WHERE scrim_id = p_scrim_id AND user_id = p_picked_user_id AND team IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not available for draft';
  END IF;

  -- Increment draft position
  v_draft_position := v_draft_position + 1;

  -- Determine next drafter using snake draft pattern
  -- Pattern: A, B, B, A, A, B, B, A, etc.
  -- Positions: 0, 1, 2, 3, 4, 5, 6, 7, ...
  -- Formula: position % 4 < 2 determines if we flip from the base pattern
  DECLARE
    v_next_drafter TEXT;
  BEGIN
    -- Snake pattern: round 0 (pos 0-1): A,B | round 1 (pos 2-3): B,A | round 2 (pos 4-5): A,B | etc.
    IF (v_draft_position / 2) % 2 = 0 THEN
      -- Even round: A, B pattern
      v_next_drafter := CASE WHEN v_draft_position % 2 = 0 THEN 'captain_a' ELSE 'captain_b' END;
    ELSE
      -- Odd round: B, A pattern
      v_next_drafter := CASE WHEN v_draft_position % 2 = 0 THEN 'captain_b' ELSE 'captain_a' END;
    END IF;

    -- Check if draft is complete
    SELECT COUNT(*) INTO v_total_players FROM public.scrim_players WHERE scrim_id = p_scrim_id;
    SELECT COUNT(*) INTO v_assigned_players FROM public.scrim_players WHERE scrim_id = p_scrim_id AND team IS NOT NULL;

    IF v_assigned_players >= v_total_players THEN
      -- Draft complete, start game
      UPDATE public.scrims
      SET status = 'in_progress',
          started_at = NOW(),
          current_drafter = NULL
      WHERE id = p_scrim_id;
    ELSE
      -- Update draft state
      UPDATE public.scrims
      SET current_drafter = v_next_drafter,
          draft_position = v_draft_position
      WHERE id = p_scrim_id;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;

-- Refresh the view to include new columns
DROP VIEW IF EXISTS public.scrims_with_counts;

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

-- Done!
