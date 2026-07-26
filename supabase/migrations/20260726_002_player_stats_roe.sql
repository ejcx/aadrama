-- Add ROE (rules of engagement / teammate shots) to per-session player stats.
-- Same grain as kills and deaths: one integer per player per session.

ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS roe integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.player_stats.roe IS
  'Rules of engagement: times this player shot a teammate in the session';
