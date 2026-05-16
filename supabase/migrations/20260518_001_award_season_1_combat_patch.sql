-- Season 1 combat patch: everyone who played at least one scrim in the Season 1 snapshot.
-- Uses session_id 'season-1' for idempotent awards (safe to re-run).

refresh materialized view player_scrim_stats_mv;

insert into public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
select
  'season_1_combat_patch',
  p.game_name,
  p.game_name_lower,
  'season-1',
  now()
from (
  select
    coalesce(pe.game_name, mv.player_name) as game_name,
    coalesce(mv.player_name_lower, pe.game_name_lower) as game_name_lower,
    greatest(
      coalesce(mv.total_scrims, 0),
      coalesce(pe.games_played, 0)
    )::integer as scrim_count
  from public.player_scrim_stats_mv mv
  full outer join public.player_elo pe
    on pe.game_name_lower = mv.player_name_lower
  where coalesce(mv.player_name_lower, pe.game_name_lower) is not null
) p
where p.scrim_count >= 1
  and not exists (
    select 1
    from public.player_badges pb
    where pb.game_name_lower = p.game_name_lower
      and pb.badge_type = 'season_1_combat_patch'
      and pb.session_id = 'season-1'
  );
