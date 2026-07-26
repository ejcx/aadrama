-- Add reconnect count to per-session player stats.
-- Same grain as kills, deaths, and roe: one integer per player per session.

ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS reconnects integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.player_stats.reconnects IS
  'Times this player reconnected during the session (typically 0, sometimes 1-10)';
