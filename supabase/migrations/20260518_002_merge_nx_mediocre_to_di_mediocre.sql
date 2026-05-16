-- Merge player profile nx.mediocre; (URL: nx.mediocre%3B) into di.mediocre (same person, new in-game name).
-- Transfers held_first_place (#1 ELO) and all other badges/stats/history to di.mediocre.

do $$
declare
  v_old_name text := 'nx.mediocre;';
  v_new_name text := 'di.mediocre';
  v_old_lower text := lower(v_old_name);
  v_new_lower text := lower(v_new_name);
  v_held_earned timestamptz;
begin
  if v_old_lower = v_new_lower then
    raise exception 'Old and new profile names must differ';
  end if;

  if not exists (select 1 from public.player_elo where game_name_lower = v_old_lower)
     and not exists (select 1 from public.elo_history where game_name_lower = v_old_lower)
     and not exists (select 1 from public.player_badges where game_name_lower = v_old_lower)
     and not exists (select 1 from public.player_stats where lower(name) = v_old_lower)
  then
    raise notice 'No data found for old profile % — nothing to merge', v_old_name;
    return;
  end if;

  select pb.earned_at
  into v_held_earned
  from public.player_badges pb
  where pb.game_name_lower = v_old_lower
    and pb.badge_type = 'held_first_place'
    and pb.session_id = 'held-first-place'
  order by pb.earned_at asc
  limit 1;

  -- Tracker session stats (drives materialized views)
  update public.player_stats
  set name = v_new_name
  where lower(name) = v_old_lower;

  -- ELO history: drop di rows that would collide on (scrim_id, game_name_lower), then re-home nx rows
  delete from public.elo_history eh_new
  where eh_new.game_name_lower = v_new_lower
    and exists (
      select 1
      from public.elo_history eh_old
      where eh_old.game_name_lower = v_old_lower
        and eh_old.scrim_id = eh_new.scrim_id
    );

  update public.elo_history
  set game_name_lower = v_new_lower
  where game_name_lower = v_old_lower;

  -- Rebuild current ELO from merged history
  delete from public.player_elo
  where game_name_lower = v_new_lower;

  update public.player_elo
  set
    game_name_lower = v_new_lower,
    game_name = v_new_name
  where game_name_lower = v_old_lower;

  perform public.recalculate_player_elo_from_history(v_new_lower);

  update public.player_elo
  set game_name = v_new_name
  where game_name_lower = v_new_lower;

  -- Linked Clerk account name (if present)
  update public.user_game_names
  set
    game_name = v_new_name,
    game_name_lower = v_new_lower
  where game_name_lower = v_old_lower
    and not exists (
      select 1 from public.user_game_names u
      where u.game_name_lower = v_new_lower
    );

  delete from public.user_game_names
  where game_name_lower = v_old_lower;

  update public.scrim_potato_votes
  set
    voted_for_game_name = v_new_name,
    voted_for_game_name_lower = v_new_lower
  where voted_for_game_name_lower = v_old_lower;

  -- Badges: remove old rows that would violate unique (game_name_lower, badge_type, session_id)
  delete from public.player_badges pb_old
  where pb_old.game_name_lower = v_old_lower
    and exists (
      select 1
      from public.player_badges pb_new
      where pb_new.game_name_lower = v_new_lower
        and pb_new.badge_type = pb_old.badge_type
        and pb_old.session_id is not distinct from pb_new.session_id
    );

  update public.player_badges
  set
    game_name_lower = v_new_lower,
    game_name = v_new_name
  where game_name_lower = v_old_lower;

  -- Ensure #1 ELO award on the merged profile (preserve original earn time when known)
  insert into public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  values (
    'held_first_place',
    v_new_name,
    v_new_lower,
    'held-first-place',
    coalesce(v_held_earned, now())
  )
  on conflict on constraint unique_player_badge_per_session do nothing;

  refresh materialized view public.player_scrim_stats_mv;
  refresh materialized view public.player_total_stats_mv;

  raise notice 'Merged % (%) into % (%). held_first_place earned_at: %',
    v_old_name, v_old_lower, v_new_name, v_new_lower, v_held_earned;
end;
$$;
