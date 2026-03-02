-- ROLLBACK SCRIPT: Remove captains pick mode changes
-- Run this in Supabase SQL Editor if you want to revert the changes

-- Drop the new functions
DROP FUNCTION IF EXISTS draft_pick_player(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS start_captain_draft(UUID);
DROP FUNCTION IF EXISTS assign_elo_balanced_teams(UUID);

-- Remove new columns from scrims table
ALTER TABLE public.scrims
DROP COLUMN IF EXISTS selection_mode,
DROP COLUMN IF EXISTS captain_a_user_id,
DROP COLUMN IF EXISTS captain_a_name,
DROP COLUMN IF EXISTS captain_b_user_id,
DROP COLUMN IF EXISTS captain_b_name,
DROP COLUMN IF EXISTS current_drafter,
DROP COLUMN IF EXISTS draft_position;

-- Restore original status constraint (without 'drafting')
ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_status_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_status_check
CHECK (status IN ('waiting', 'ready_check', 'in_progress', 'scoring', 'finalized', 'expired', 'cancelled'));

-- Refresh the view (in case it was updated)
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

-- Done! Your database should now be back to the state before these migrations.
