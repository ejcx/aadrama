-- Player Badges: pin-style awards earned during a scrim or game session.
-- Modeled after elo_history (per game_name_lower, per session record).
-- session_id is text so it can hold either a scrim UUID or a legacy
-- game_sessions.session_id (text). The same player can earn the same badge
-- in different sessions, so uniqueness is on (game_name_lower, badge_type, session_id).

create table public.player_badges (
  id uuid primary key default gen_random_uuid(),
  badge_type text not null,                       -- e.g. 'potato'
  game_name text not null,                        -- Display name (original case)
  game_name_lower text not null,                  -- Lowercase for case-insensitive lookups
  session_id text,                                -- Scrim UUID or game_sessions.session_id; null = manually awarded
  earned_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),

  -- One award of a given badge per player per session.
  -- session_id NULL is allowed multiple times (manual awards) since NULLs
  -- are not considered equal in unique constraints.
  constraint unique_player_badge_per_session unique (game_name_lower, badge_type, session_id)
);

-- Lookup all badges for a player (profile page).
create index idx_player_badges_player on public.player_badges (game_name_lower, earned_at desc);

-- Lookup all badges awarded in a session.
create index idx_player_badges_session on public.player_badges (session_id);

-- Lookup leaderboards by badge type ("everyone who has the potato badge").
create index idx_player_badges_type on public.player_badges (badge_type, earned_at desc);
