-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to delete scrims that have not started after 20 minutes
CREATE OR REPLACE FUNCTION delete_stale_scrims()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.scrims
  WHERE status = 'waiting'
    AND expires_at < NOW()
    AND started_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % stale scrim(s)', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule the function to run every minute
SELECT cron.schedule(
  'delete-stale-scrims',
  '* * * * *',
  $$ SELECT delete_stale_scrims(); $$
);

COMMENT ON FUNCTION delete_stale_scrims IS 'Automatically deletes scrims that have not started within 20 minutes of creation';
