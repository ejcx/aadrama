-- Potato award voting (losing team) + RLS for player_badges

create table if not exists public.scrim_potato_votes (
  id uuid primary key default gen_random_uuid(),
  scrim_id uuid not null references public.scrims(id) on delete cascade,
  voter_user_id text not null,
  voted_for_game_name text not null,
  voted_for_game_name_lower text not null,
  created_at timestamptz not null default now(),
  constraint scrim_potato_votes_unique_voter unique (scrim_id, voter_user_id)
);

create index if not exists idx_scrim_potato_votes_scrim
  on public.scrim_potato_votes (scrim_id);

alter table public.scrims
  add column if not exists auto_badges_processed_at timestamptz;

alter table public.player_badges enable row level security;

drop policy if exists "Anyone can view player badges" on public.player_badges;
create policy "Anyone can view player badges" on public.player_badges
  for select using (true);

drop policy if exists "Authenticated can insert player badges" on public.player_badges;
create policy "Authenticated can insert player badges" on public.player_badges
  for insert with check (true);

alter table public.scrim_potato_votes enable row level security;

drop policy if exists "Anyone can view potato votes" on public.scrim_potato_votes;
create policy "Anyone can view potato votes" on public.scrim_potato_votes
  for select using (true);

drop policy if exists "Participants can vote potato" on public.scrim_potato_votes;
create policy "Participants can vote potato" on public.scrim_potato_votes
  for insert with check (true);

drop policy if exists "Voters can update potato vote" on public.scrim_potato_votes;
create policy "Voters can update potato vote" on public.scrim_potato_votes
  for update using (true);
