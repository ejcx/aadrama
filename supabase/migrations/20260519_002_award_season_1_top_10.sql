-- Season 1 Top 10: final Season 1 ELO leaderboard (games before Season 2 start).
-- Uses session_id 'season-1' for idempotent awards (safe to re-run).

do $$
declare
  v_inserted integer;
  v_season_2_start timestamptz := '2026-05-16T17:00:00+00'::timestamptz;
begin
  with season1_elo as (
    select
      eh.game_name_lower,
      (1200 + sum(eh.elo_change))::integer as season1_elo,
      count(*)::integer as games_played
    from public.elo_history eh
    where eh.created_at < v_season_2_start
    group by eh.game_name_lower
  ),
  ranked as (
    select
      se.game_name_lower,
      se.season1_elo,
      se.games_played,
      row_number() over (
        order by se.season1_elo desc, se.games_played desc, se.game_name_lower asc
      ) as rank
    from season1_elo se
  ),
  top10 as (
    select r.game_name_lower, r.season1_elo, r.rank
    from ranked r
    where r.rank <= 10
  )
  insert into public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  select
    'season_1_top_10',
    coalesce(pe.game_name, t.game_name_lower),
    t.game_name_lower,
    'season-1',
    v_season_2_start
  from top10 t
  left join public.player_elo pe on pe.game_name_lower = t.game_name_lower
  on conflict on constraint unique_player_badge_per_session do nothing;

  get diagnostics v_inserted = row_count;

  raise notice 'Season 1 Top 10: % badge row(s) inserted (or already present).', v_inserted;
end;
$$;
