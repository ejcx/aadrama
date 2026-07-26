-- Tracker API (aadb) requires these columns. Without them, GET /sessions
-- returns 500 "failed to list sessions" for every session (old and new).
-- DEFAULT 0 backfills existing rows.
--
-- Same as aadb migrations/006_add_roe_and_reconnects.sql

-- Rules-of-engagement violations per team, tracked per session
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS roe_team0 integer NOT NULL DEFAULT 0;
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS roe_team1 integer NOT NULL DEFAULT 0;

-- Number of times a player rejoined an existing session at 0-0 after already having played
ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS reconnects integer NOT NULL DEFAULT 0;
