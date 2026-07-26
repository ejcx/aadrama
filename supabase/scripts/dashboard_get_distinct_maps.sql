-- ONLY run this if get_distinct_maps is missing or broken.
-- Run ALONE (uses $func$ ... $func$ instead of $$ so the dashboard does not truncate).
-- After this, you still need dashboard_tracker_elo_rls.sql for RLS on player_stats.

create or replace function public.get_distinct_maps()
returns table (map text)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  return query
  select distinct ps.map
  from public.player_stats ps
  where ps.map is not null and ps.map <> ''
  order by ps.map;
end;
$func$;

grant execute on function public.get_distinct_maps() to anon, authenticated;
