-- Season 1 activity badges by scrim volume (Season 1 snapshot).
-- Scrim count = max(player_scrim_stats_mv.total_scrims, player_elo.games_played).
-- Players earn every tier they qualify for (50 / 100 / 200 / 300+).
-- session_id 'season-1' + badge_type keeps awards idempotent.

-- Non-concurrent refresh (CONCURRENTLY cannot run inside a migration transaction).
refresh materialized view player_scrim_stats_mv;

do $$
declare
  v_inserted int;
  v_scrimlord int;
  v_cal_i int;
  v_keeping int;
  v_always int;
begin
  with player_scrim_counts as (
    select
      coalesce(mv.player_name_lower, pe.game_name_lower) as game_name_lower,
      coalesce(pe.game_name, mv.player_name) as game_name,
      greatest(
        coalesce(mv.total_scrims, 0),
        coalesce(pe.games_played, 0)
      )::integer as scrim_count
    from public.player_scrim_stats_mv mv
    full outer join public.player_elo pe
      on pe.game_name_lower = mv.player_name_lower
    where coalesce(mv.player_name_lower, pe.game_name_lower) is not null
  ),
  awards as (
    select game_name, game_name_lower, 'scrimlord'::text as badge_type
    from player_scrim_counts
    where scrim_count >= 50

    union all

    select game_name, game_name_lower, 'cal_i_activity_confirmed'
    from player_scrim_counts
    where scrim_count >= 100

    union all

    select game_name, game_name_lower, 'keeping_the_game_alive'
    from player_scrim_counts
    where scrim_count >= 200

    union all

    select game_name, game_name_lower, 'always_online'
    from player_scrim_counts
    where scrim_count >= 300
  )
  insert into public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  select
    a.badge_type,
    a.game_name,
    a.game_name_lower,
    'season-1',
    now()
  from awards a
  where not exists (
    select 1
    from public.player_badges pb
    where pb.game_name_lower = a.game_name_lower
      and pb.badge_type = a.badge_type
      and pb.session_id = 'season-1'
  );

  get diagnostics v_inserted = row_count;

  select count(*)::int into v_scrimlord
  from public.player_badges
  where badge_type = 'scrimlord' and session_id = 'season-1';

  select count(*)::int into v_cal_i
  from public.player_badges
  where badge_type = 'cal_i_activity_confirmed' and session_id = 'season-1';

  select count(*)::int into v_keeping
  from public.player_badges
  where badge_type = 'keeping_the_game_alive' and session_id = 'season-1';

  select count(*)::int into v_always
  from public.player_badges
  where badge_type = 'always_online' and session_id = 'season-1';

  raise notice 'Season 1 activity badges: inserted % rows. Totals — scrimlord: %, cal-i: %, keeping the game alive: %, always online: %',
    v_inserted, v_scrimlord, v_cal_i, v_keeping, v_always;
end;
$$;
