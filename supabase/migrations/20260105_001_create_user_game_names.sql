-- User Game Names: Maps user accounts to in-game names
-- Anyone can declare any name as theirs (no verification)

create table public.user_game_names (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                          -- Clerk user ID
  game_name text not null,                        -- The in-game name
  game_name_lower text not null,                  -- Lowercase for case-insensitive uniqueness
  created_at timestamp with time zone not null default now(),
  
  -- Each game name can only be claimed once (case-insensitive)
  constraint unique_game_name_lower unique (game_name_lower)
);

-- Index for user lookups
create index idx_user_game_names_user_id on public.user_game_names (user_id);

-- Index for game name lookups
create index idx_user_game_names_game_name_lower on public.user_game_names (game_name_lower);
