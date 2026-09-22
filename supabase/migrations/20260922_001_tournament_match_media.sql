-- Per-match VODs/streams/clips for Fall Classic (and later tournaments).
-- Writes are gated in Next.js by the Clerk admin user id; RLS matches other
-- admin-updated tables (open to the anon key used by server actions).

create table if not exists public.tournament_match_media (
  tournament_id text not null,
  week integer not null,
  home text not null,
  away text not null,
  streams jsonb not null default '[]'::jsonb,
  clips jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, week, home, away)
);

alter table public.tournament_match_media enable row level security;

grant select, insert, update, delete on public.tournament_match_media to anon, authenticated;

drop policy if exists "Anyone can view tournament match media" on public.tournament_match_media;
create policy "Anyone can view tournament match media"
  on public.tournament_match_media
  for select
  using (true);

drop policy if exists "Allow tournament match media insert" on public.tournament_match_media;
create policy "Allow tournament match media insert"
  on public.tournament_match_media
  for insert
  with check (true);

drop policy if exists "Allow tournament match media update" on public.tournament_match_media;
create policy "Allow tournament match media update"
  on public.tournament_match_media
  for update
  using (true);

drop policy if exists "Allow tournament match media delete" on public.tournament_match_media;
create policy "Allow tournament match media delete"
  on public.tournament_match_media
  for delete
  using (true);
