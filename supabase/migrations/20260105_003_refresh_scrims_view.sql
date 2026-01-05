-- Recreate the scrims_with_counts view to include is_ranked and ranked_processed_at columns
-- These columns were added after the original view was created

DROP VIEW IF EXISTS public.scrims_with_counts;

CREATE VIEW public.scrims_with_counts AS
SELECT 
  s.id,
  s.created_by,
  s.created_by_name,
  s.title,
  s.map,
  s.max_players_per_team,
  s.min_players_per_team,
  s.status,
  s.team_a_score,
  s.team_b_score,
  s.winner,
  s.tracker_session_id,
  s.is_ranked,
  s.ranked_processed_at,
  s.created_at,
  s.expires_at,
  s.ready_check_at,
  s.started_at,
  s.finished_at,
  s.finalized_at,
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

