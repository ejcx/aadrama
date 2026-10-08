-- Undo 20261008_002_expire_stale_scrims_skip_noop.sql

-- No error if the job is already gone
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-player-scrim-stats-mv';

CREATE OR REPLACE FUNCTION public.expire_stale_scrims()
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

COMMENT ON FUNCTION expire_stale_scrims IS 'Marks scrims as expired if they exceed their expiration time';

DROP TRIGGER IF EXISTS trigger_refresh_scrim_stats ON public.scrims;
CREATE TRIGGER trigger_refresh_scrim_stats
AFTER UPDATE OF status, finalized_at ON public.scrims
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_player_scrim_stats_mv();
