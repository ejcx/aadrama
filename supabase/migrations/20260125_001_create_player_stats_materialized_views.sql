-- ============================================
-- Migration: Create Player Stats Materialized Views
-- Created: 2026-01-25
-- Purpose: Improve performance for player statistics queries
--          - Eliminate N+1 query patterns
--          - Pre-aggregate player stats for fast lookups
--          - Auto-refresh on scrim finalization and session updates
-- ============================================

-- ============================================
-- Part 1: Create Scrim Stats Materialized View
-- ============================================

-- This view aggregates statistics ONLY from scrim sessions
-- (sessions linked via scrims.tracker_session_id)

CREATE MATERIALIZED VIEW IF NOT EXISTS player_scrim_stats_mv AS
WITH scrim_sessions AS (
  -- Explode tracker_session_id into individual session IDs
  -- Handles multiple session IDs separated by +, ~, or spaces
  SELECT
    s.id as scrim_id,
    s.map,
    s.finalized_at,
    regexp_split_to_table(s.tracker_session_id, '[+~\s]+') as session_id
  FROM scrims s
  WHERE
    s.status = 'finalized'
    AND s.tracker_session_id IS NOT NULL
    AND s.tracker_session_id != ''
),
scrim_player_stats AS (
  -- Join with player_stats to get kills/deaths per player per scrim
  SELECT
    lower(ps.name) as player_name_lower,
    ps.name as original_name,
    ps.kills,
    ps.deaths,
    ps.time,
    ss.scrim_id,
    ss.map
  FROM player_stats ps
  INNER JOIN scrim_sessions ss ON ps.session_id = ss.session_id
),
ranked_names AS (
  -- Get the most recent name casing for each player
  SELECT DISTINCT ON (player_name_lower)
    player_name_lower,
    original_name as player_name
  FROM scrim_player_stats
  ORDER BY player_name_lower, time DESC
)
SELECT
  sps.player_name_lower,
  rn.player_name,
  COUNT(DISTINCT sps.scrim_id) as total_scrims,
  SUM(sps.kills) as total_scrim_kills,
  SUM(sps.deaths) as total_scrim_deaths,
  CASE
    WHEN SUM(sps.deaths) > 0 THEN ROUND((SUM(sps.kills)::numeric / SUM(sps.deaths)::numeric), 2)
    WHEN SUM(sps.kills) > 0 THEN 999.99
    ELSE 0.00
  END as scrim_kd_ratio,
  MAX(sps.time) as last_played,
  NOW() as last_refreshed_at
FROM scrim_player_stats sps
INNER JOIN ranked_names rn ON sps.player_name_lower = rn.player_name_lower
GROUP BY sps.player_name_lower, rn.player_name;

COMMENT ON MATERIALIZED VIEW player_scrim_stats_mv IS
'Aggregated player statistics from scrim sessions only. Auto-refreshes when scrims are finalized.';

-- ============================================
-- Part 2: Create Total Stats Materialized View
-- ============================================

-- This view aggregates statistics from ALL sessions
-- (not just scrims - includes all player_stats records)

CREATE MATERIALIZED VIEW IF NOT EXISTS player_total_stats_mv AS
WITH ranked_names AS (
  -- Get the most recent name casing for each player
  SELECT DISTINCT ON (lower(name))
    lower(name) as player_name_lower,
    name as player_name
  FROM player_stats
  ORDER BY lower(name), time DESC
)
SELECT
  rn.player_name_lower,
  rn.player_name,
  COUNT(DISTINCT ps.session_id) as total_games,
  SUM(ps.kills) as total_kills,
  SUM(ps.deaths) as total_deaths,
  CASE
    WHEN SUM(ps.deaths) > 0 THEN ROUND((SUM(ps.kills)::numeric / SUM(ps.deaths)::numeric), 2)
    WHEN SUM(ps.kills) > 0 THEN 999.99
    ELSE 0.00
  END as kd_ratio,
  MAX(ps.time) as last_played,
  NOW() as last_refreshed_at
FROM player_stats ps
INNER JOIN ranked_names rn ON lower(ps.name) = rn.player_name_lower
GROUP BY rn.player_name_lower, rn.player_name;

COMMENT ON MATERIALIZED VIEW player_total_stats_mv IS
'Aggregated player statistics from all sessions. Refreshes periodically or on player_stats changes.';

-- ============================================
-- Part 3: Create Indexes for Fast Lookups
-- ============================================

-- Indexes for player_scrim_stats_mv
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_scrim_stats_mv_player
ON player_scrim_stats_mv(player_name_lower);

CREATE INDEX IF NOT EXISTS idx_player_scrim_stats_mv_kills
ON player_scrim_stats_mv(total_scrim_kills DESC);

CREATE INDEX IF NOT EXISTS idx_player_scrim_stats_mv_kd
ON player_scrim_stats_mv(scrim_kd_ratio DESC);

COMMENT ON INDEX idx_player_scrim_stats_mv_player IS
'Unique index on player name (required for CONCURRENTLY refresh)';

-- Indexes for player_total_stats_mv
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_total_stats_mv_player
ON player_total_stats_mv(player_name_lower);

CREATE INDEX IF NOT EXISTS idx_player_total_stats_mv_kills
ON player_total_stats_mv(total_kills DESC);

CREATE INDEX IF NOT EXISTS idx_player_total_stats_mv_kd
ON player_total_stats_mv(kd_ratio DESC);

CREATE INDEX IF NOT EXISTS idx_player_total_stats_mv_last_played
ON player_total_stats_mv(last_played DESC);

COMMENT ON INDEX idx_player_total_stats_mv_player IS
'Unique index on player name (required for CONCURRENTLY refresh)';

-- ============================================
-- Part 4: Create Refresh Trigger Function
-- ============================================

-- Function to refresh scrim stats materialized view
CREATE OR REPLACE FUNCTION refresh_player_scrim_stats_mv()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh concurrently to avoid blocking reads
  -- This allows queries to continue while the view is being updated
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_scrim_stats_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_player_scrim_stats_mv() IS
'Automatically refreshes player_scrim_stats_mv when scrims are finalized';

-- Function to refresh total stats materialized view
CREATE OR REPLACE FUNCTION refresh_player_total_stats_mv()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_total_stats_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_player_total_stats_mv() IS
'Automatically refreshes player_total_stats_mv when player_stats are updated';

-- ============================================
-- Part 5: Create Triggers for Auto-Refresh
-- ============================================

-- Trigger on scrims table when status changes to 'finalized'
-- Statement-level trigger (fires once per transaction, not per row)
DROP TRIGGER IF EXISTS trigger_refresh_scrim_stats ON scrims;
CREATE TRIGGER trigger_refresh_scrim_stats
AFTER UPDATE OF status, finalized_at ON scrims
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_player_scrim_stats_mv();

COMMENT ON TRIGGER trigger_refresh_scrim_stats ON scrims IS
'Refreshes player_scrim_stats_mv when scrims are finalized';

-- Trigger on player_stats table when new stats are inserted
-- Note: This may cause frequent refreshes. Consider using pg_cron for scheduled refreshes instead.
-- For now, we'll use a trigger but with statement-level to batch updates
DROP TRIGGER IF EXISTS trigger_refresh_total_stats ON player_stats;
CREATE TRIGGER trigger_refresh_total_stats
AFTER INSERT OR UPDATE ON player_stats
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_player_total_stats_mv();

COMMENT ON TRIGGER trigger_refresh_total_stats ON player_stats IS
'Refreshes player_total_stats_mv when new player stats are added. Consider using pg_cron for less frequent updates.';

-- ============================================
-- Part 6: Initial Population
-- ============================================

-- Populate the materialized views with existing data
REFRESH MATERIALIZED VIEW player_scrim_stats_mv;
REFRESH MATERIALIZED VIEW player_total_stats_mv;

-- ============================================
-- Part 7: Create Helper View for Monitoring
-- ============================================

CREATE OR REPLACE VIEW player_stats_mv_health AS
SELECT
  'player_scrim_stats_mv' as view_name,
  (SELECT COUNT(*) FROM player_scrim_stats_mv) as row_count,
  (SELECT MAX(last_refreshed_at) FROM player_scrim_stats_mv) as last_refresh,
  (SELECT NOW() - MAX(last_refreshed_at) FROM player_scrim_stats_mv) as staleness
UNION ALL
SELECT
  'player_total_stats_mv' as view_name,
  (SELECT COUNT(*) FROM player_total_stats_mv) as row_count,
  (SELECT MAX(last_refreshed_at) FROM player_total_stats_mv) as last_refresh,
  (SELECT NOW() - MAX(last_refreshed_at) FROM player_total_stats_mv) as staleness;

COMMENT ON VIEW player_stats_mv_health IS
'Monitor the health and freshness of player stats materialized views';

-- ============================================
-- Part 8: Grant Permissions
-- ============================================

-- Grant SELECT permissions on materialized views to allow API access
GRANT SELECT ON player_scrim_stats_mv TO anon, authenticated;
GRANT SELECT ON player_total_stats_mv TO anon, authenticated;
GRANT SELECT ON player_stats_mv_health TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW player_scrim_stats_mv IS
'Public accessible: Aggregated player statistics from scrim sessions only. Auto-refreshes when scrims are finalized.';

COMMENT ON MATERIALIZED VIEW player_total_stats_mv IS
'Public accessible: Aggregated player statistics from all sessions. Auto-refreshes when new stats are added.';

-- Done! The materialized views are now created and will auto-refresh.
-- To manually refresh if needed:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY player_scrim_stats_mv;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY player_total_stats_mv;
