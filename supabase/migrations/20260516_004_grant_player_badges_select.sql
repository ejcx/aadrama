-- player_badges was created without GRANTs; PostgREST/anon cannot read rows without these.
grant select on public.player_badges to anon, authenticated;

-- Ensure read policy exists (idempotent with 20260516_001)
alter table public.player_badges enable row level security;

drop policy if exists "Anyone can view player badges" on public.player_badges;
create policy "Anyone can view player badges" on public.player_badges
  for select using (true);
