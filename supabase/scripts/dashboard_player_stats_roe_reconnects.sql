-- Required by tracker API (aadb): ListSessions SELECTs roe_team0/roe_team1.
-- Without these columns, GET /sessions returns 500 "failed to list sessions".
-- DEFAULT 0 backfills every existing (old) session row.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS roe_team0 integer NOT NULL DEFAULT 0;

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS roe_team1 integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.game_sessions.roe_team0 IS
  'Rules-of-engagement violations for team 0 in this session';
COMMENT ON COLUMN public.game_sessions.roe_team1 IS
  'Rules-of-engagement violations for team 1 in this session';

-- Per-player reconnect count (player session detail queries)
ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS reconnects integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.player_stats.reconnects IS
  'Times this player reconnected during the session (typically 0, sometimes 1-10)';
