-- Tracker + ELO tables were created without RLS; enabling RLS in Supabase without
-- policies/grants blocks PostgREST reads (anon key used by Next.js server actions).
-- Pattern matches player_badges (20260516_004) and scrims (open SELECT).
--
-- IMPORTANT (Supabase SQL Editor):
-- Run THIS FILE ALONE. Do not paste it together with other migrations.
-- Scripts that define functions with $$ ... $$ will fail with "unterminated dollar-quoted
-- string" if the editor splits the paste. You do NOT need to recreate get_distinct_maps here.

-- ---------------------------------------------------------------------------
-- player_stats (scrim map picker via get_distinct_maps, tracker K/D)
-- ---------------------------------------------------------------------------
grant select on public.player_stats to anon, authenticated;

alter table public.player_stats enable row level security;

drop policy if exists "Anyone can view player stats" on public.player_stats;
create policy "Anyone can view player stats"
  on public.player_stats
  for select
  using (true);

grant execute on function public.get_distinct_maps() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- game_sessions (tracker session browser)
-- ---------------------------------------------------------------------------
grant select on public.game_sessions to anon, authenticated;

alter table public.game_sessions enable row level security;

drop policy if exists "Anyone can view game sessions" on public.game_sessions;
create policy "Anyone can view game sessions"
  on public.game_sessions
  for select
  using (true);

-- ---------------------------------------------------------------------------
-- player_elo + elo_history (ELO leaderboard, player pages, scrim processing)
-- ---------------------------------------------------------------------------
grant select on public.player_elo to anon, authenticated;
grant select on public.elo_history to anon, authenticated;

alter table public.player_elo enable row level security;
alter table public.elo_history enable row level security;

drop policy if exists "Anyone can view player elo" on public.player_elo;
create policy "Anyone can view player elo"
  on public.player_elo
  for select
  using (true);

drop policy if exists "Anyone can view elo history" on public.elo_history;
create policy "Anyone can view elo history"
  on public.elo_history
  for select
  using (true);

-- process_player_elo and admin reruns run as the API role (not SECURITY DEFINER)
drop policy if exists "Allow player elo insert" on public.player_elo;
create policy "Allow player elo insert"
  on public.player_elo
  for insert
  with check (true);

drop policy if exists "Allow player elo update" on public.player_elo;
create policy "Allow player elo update"
  on public.player_elo
  for update
  using (true);

drop policy if exists "Allow elo history insert" on public.elo_history;
create policy "Allow elo history insert"
  on public.elo_history
  for insert
  with check (true);

drop policy if exists "Allow elo history delete" on public.elo_history;
create policy "Allow elo history delete"
  on public.elo_history
  for delete
  using (true);

-- ---------------------------------------------------------------------------
-- user_game_names (account linking; Clerk user_id in row)
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.user_game_names to anon, authenticated;

alter table public.user_game_names enable row level security;

drop policy if exists "Anyone can view game names" on public.user_game_names;
create policy "Anyone can view game names"
  on public.user_game_names
  for select
  using (true);

drop policy if exists "Users can claim game names" on public.user_game_names;
create policy "Users can claim game names"
  on public.user_game_names
  for insert
  with check (true);

drop policy if exists "Users can release game names" on public.user_game_names;
create policy "Users can release game names"
  on public.user_game_names
  for delete
  using (true);

-- ---------------------------------------------------------------------------
-- Materialized views (leaderboard K/D, player search)
-- RLS cannot be enabled on materialized views (PG 42809 on Supabase).
-- GRANT SELECT is sufficient for PostgREST / anon reads.
-- ---------------------------------------------------------------------------
grant select on public.player_scrim_stats_mv to anon, authenticated;
grant select on public.player_total_stats_mv to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Views used by PostgREST
-- ---------------------------------------------------------------------------
grant select on public.scrims_with_counts to anon, authenticated;
