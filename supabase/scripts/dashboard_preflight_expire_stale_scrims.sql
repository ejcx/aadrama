-- Run on prod before 20261008_002_expire_stale_scrims_skip_noop.sql.
-- All SELECTs. Run one at a time.

-- 1) Time spent in expire_stale_scrims today. A mean around 20ms or more is
--    the view rebuild the migration removes. Under 2ms means prod is not
--    rebuilding on each poll and the migration will not help.
select calls,
       round(mean_exec_time::numeric, 1)  as mean_ms,
       round(max_exec_time::numeric, 1)   as max_ms,
       round((total_exec_time / 1000)::numeric, 0) as total_seconds,
       left(query, 80) as query
from extensions.pg_stat_statements
where query ilike '%expire_stale_scrims%'
  and query not ilike 'create%'
  and query not ilike 'do %'
order by total_exec_time desc
limit 5;

-- 2) Should be a single UPDATE setting status = 'expired' for waiting scrims
--    past expires_at. If prod has more in it, the migration would overwrite it.
select pg_get_functiondef('public.expire_stale_scrims()'::regprocedure);

-- 3) Should be AFTER UPDATE OF status, finalized_at ... FOR EACH STATEMENT
select pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.scrims'::regclass
  and tgname = 'trigger_refresh_scrim_stats';

-- 4) Should return one row. REFRESH CONCURRENTLY needs it.
select indexdef
from pg_indexes
where tablename = 'player_scrim_stats_mv'
  and indexdef ilike '%unique%';

-- 5) Should list delete-stale-scrims, so pg_cron is there
select jobname, schedule, active from cron.job;
