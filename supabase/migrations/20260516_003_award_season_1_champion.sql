-- Award the Season 1 Champion badge to the player with the highest current ELO.
-- Uses session_id 'season-1' so this snapshot is idempotent (safe to re-run).
-- Tie-break: highest elo, then most ranked games played, then game_name_lower.

do $$
declare
  v_champion record;
begin
  if exists (
    select 1
    from public.player_badges
    where badge_type = 'season_1_champion'
      and session_id = 'season-1'
  ) then
    raise notice 'Season 1 Champion badge already awarded; skipping.';
    return;
  end if;

  select game_name, game_name_lower, elo, games_played
  into v_champion
  from public.player_elo
  order by elo desc, games_played desc, game_name_lower asc
  limit 1;

  if v_champion is null then
    raise notice 'No rows in player_elo; Season 1 Champion badge not awarded.';
    return;
  end if;

  insert into public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  values (
    'season_1_champion',
    v_champion.game_name,
    v_champion.game_name_lower,
    'season-1',
    now()
  );

  raise notice 'Season 1 Champion awarded to % (ELO %, % ranked games).',
    v_champion.game_name,
    v_champion.elo,
    v_champion.games_played;
end;
$$;
