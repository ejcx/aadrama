-- The /scrim page calls expire_stale_scrims() on every poll. Its UPDATE fired
-- trigger_refresh_scrim_stats even when no scrim was stale, so
-- player_scrim_stats_mv was rebuilt on every poll, for every viewer.
-- To undo, run ROLLBACK_expire_stale_scrims_skip_noop.sql.

-- Skip the UPDATE when nothing is stale
CREATE OR REPLACE FUNCTION public.expire_stale_scrims()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.scrims
    WHERE status = 'waiting'
      AND expires_at < NOW()
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.scrims
  SET status = 'expired'
  WHERE status = 'waiting'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_stale_scrims IS 'Marks scrims as expired if they exceed their expiration time';

-- The polls were also what picked up late player_stats. Do that once a minute.
SELECT cron.schedule(
  'refresh-player-scrim-stats-mv',
  '* * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.player_scrim_stats_mv; $$
);

-- Refresh when a tracker session is linked, not only on status changes
DROP TRIGGER IF EXISTS trigger_refresh_scrim_stats ON public.scrims;
CREATE TRIGGER trigger_refresh_scrim_stats
AFTER UPDATE OF status, finalized_at, tracker_session_id ON public.scrims
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_player_scrim_stats_mv();
