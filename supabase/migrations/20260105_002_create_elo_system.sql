-- ELO System: Track player ratings based on scrim performance
-- ELO is tracked per in-game name (game_name_lower)

-- Player ELO table - stores current ELO for each game name
create table public.player_elo (
  id uuid primary key default gen_random_uuid(),
  game_name_lower text not null unique,           -- Lowercase game name (matches user_game_names)
  game_name text not null,                        -- Display name
  elo integer not null default 1200,              -- Current ELO rating
  games_played integer not null default 0,        -- Total ranked games played
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Index for ELO leaderboard queries
create index idx_player_elo_rating on public.player_elo (elo desc);
create index idx_player_elo_games on public.player_elo (games_played desc);

-- ELO History table - track all ELO changes
create table public.elo_history (
  id uuid primary key default gen_random_uuid(),
  game_name_lower text not null,
  scrim_id uuid not null references public.scrims(id),
  elo_before integer not null,
  elo_after integer not null,
  elo_change integer not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  team_score integer not null,                    -- Rounds for
  opponent_score integer not null,                -- Rounds against
  kills integer,                                  -- Player's kills in the session
  k_factor integer not null,                      -- K-factor used for this calculation
  created_at timestamp with time zone not null default now()
);

-- Index for player history lookups
create index idx_elo_history_player on public.elo_history (game_name_lower, created_at desc);
create index idx_elo_history_scrim on public.elo_history (scrim_id);

-- Add ranked status to scrims table
-- is_ranked: Set at scrim creation time (default true for new scrims)
-- ranked_processed_at: Set when ELO is calculated
alter table public.scrims add column if not exists is_ranked boolean default true;
alter table public.scrims add column if not exists ranked_processed_at timestamp with time zone;

-- Function to update updated_at timestamp
create or replace function update_player_elo_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger player_elo_updated_at
  before update on public.player_elo
  for each row
  execute function update_player_elo_updated_at();

-- Function to get or create player ELO record
create or replace function get_or_create_player_elo(p_game_name text)
returns public.player_elo as $$
declare
  v_game_name_lower text := lower(p_game_name);
  v_record public.player_elo;
begin
  -- Try to get existing record
  select * into v_record from public.player_elo where game_name_lower = v_game_name_lower;
  
  -- If not found, create one
  if not found then
    insert into public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
    values (v_game_name_lower, p_game_name, 1200, 0, 0, 0, 0)
    returning * into v_record;
  end if;
  
  return v_record;
end;
$$ language plpgsql;

-- Function to calculate K-factor based on games played
-- Starts at 40 for new players, decreases to minimum of 10
create or replace function calculate_k_factor(p_games_played integer)
returns integer as $$
begin
  if p_games_played < 10 then
    return 40;  -- New player, high volatility
  elsif p_games_played < 30 then
    return 32;  -- Intermediate
  elsif p_games_played < 50 then
    return 24;  -- Experienced
  else
    return 16;  -- Veteran, stable rating
  end if;
end;
$$ language plpgsql immutable;

-- Function to calculate expected score (probability of winning)
create or replace function calculate_expected_score(p_player_elo integer, p_opponent_elo integer)
returns float as $$
begin
  return 1.0 / (1.0 + power(10, (p_opponent_elo - p_player_elo)::float / 400.0));
end;
$$ language plpgsql immutable;

-- Function to calculate ELO change for a player
-- Takes into account: result, score margin, and individual performance (kills)
create or replace function calculate_elo_change(
  p_player_elo integer,
  p_opponent_avg_elo integer,
  p_k_factor integer,
  p_result text,                -- 'win', 'loss', 'draw'
  p_team_score integer,
  p_opponent_score integer,
  p_player_kills integer,
  p_team_total_kills integer
) returns integer as $$
declare
  v_expected float;
  v_actual float;
  v_base_change float;
  v_margin_multiplier float;
  v_performance_bonus float;
  v_final_change integer;
begin
  -- Calculate expected score
  v_expected := calculate_expected_score(p_player_elo, p_opponent_avg_elo);
  
  -- Actual score (1 for win, 0.5 for draw, 0 for loss)
  if p_result = 'win' then
    v_actual := 1.0;
  elsif p_result = 'draw' then
    v_actual := 0.5;
  else
    v_actual := 0.0;
  end if;
  
  -- Base ELO change
  v_base_change := p_k_factor * (v_actual - v_expected);
  
  -- Score margin multiplier (bigger wins/losses have more impact)
  -- Uses log scale to prevent extreme values
  if p_team_score > 0 or p_opponent_score > 0 then
    v_margin_multiplier := 1.0 + (ln(1.0 + abs(p_team_score - p_opponent_score)::float) / 3.0);
  else
    v_margin_multiplier := 1.0;
  end if;
  
  -- Performance bonus for winners based on kill contribution
  -- If you got more kills than average on your team, you get a bonus
  v_performance_bonus := 0;
  if p_result = 'win' and p_team_total_kills > 0 and p_player_kills is not null then
    -- Calculate what fraction of team kills this player got
    -- Bonus is up to 20% extra ELO for carrying the team
    v_performance_bonus := v_base_change * 0.2 * 
      greatest(0, (p_player_kills::float / p_team_total_kills::float) - 0.25) * 4;
  end if;
  
  -- Final calculation
  v_final_change := round(v_base_change * v_margin_multiplier + v_performance_bonus)::integer;
  
  return v_final_change;
end;
$$ language plpgsql immutable;

-- =====================================================
-- STORED PROCEDURE: Process ELO for a single player
-- =====================================================
-- Simplified interface - just pass:
--   - in-game name
--   - rounds for/against
--   - kills
--   - opponent average ELO
--
-- SELECT * FROM process_player_elo(
--   p_scrim_id := 'uuid-here',
--   p_game_name := 'PlayerName',
--   p_rounds_for := 10,
--   p_rounds_against := 5,
--   p_kills := 15,
--   p_opponent_avg_elo := 1200
-- );
-- =====================================================

create or replace function process_player_elo(
  p_scrim_id uuid,
  p_game_name text,
  p_rounds_for integer,
  p_rounds_against integer,
  p_kills integer default 0,
  p_opponent_avg_elo integer default 1200
) returns table (
  game_name text,
  elo_before integer,
  elo_after integer,
  elo_change integer,
  result text,
  k_factor integer
) as $$
declare
  v_game_name_lower text := lower(p_game_name);
  v_player_elo record;
  v_result text;
  v_expected float;
  v_actual float;
  v_k_factor integer;
  v_base_change float;
  v_margin_multiplier float;
  v_kill_bonus float;
  v_elo_change integer;
  v_new_elo integer;
begin
  -- Get or create player ELO record
  select * into v_player_elo from public.player_elo pe where pe.game_name_lower = v_game_name_lower;
  
  if not found then
    insert into public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
    values (v_game_name_lower, p_game_name, 1200, 0, 0, 0, 0)
    returning * into v_player_elo;
  end if;
  
  -- Determine result
  if p_rounds_for > p_rounds_against then
    v_result := 'win';
  elsif p_rounds_for < p_rounds_against then
    v_result := 'loss';
  else
    v_result := 'draw';
  end if;
  
  -- Calculate K-factor based on games played
  v_k_factor := calculate_k_factor(v_player_elo.games_played);
  
  -- Calculate expected score (probability of winning)
  v_expected := calculate_expected_score(v_player_elo.elo, p_opponent_avg_elo);
  
  -- Actual score (1 for win, 0.5 for draw, 0 for loss)
  if v_result = 'win' then
    v_actual := 1.0;
  elsif v_result = 'draw' then
    v_actual := 0.5;
  else
    v_actual := 0.0;
  end if;
  
  -- Base ELO change
  v_base_change := v_k_factor * (v_actual - v_expected);
  
  -- Score margin multiplier (bigger wins/losses have more impact)
  v_margin_multiplier := 1.0 + (ln(1.0 + abs(p_rounds_for - p_rounds_against)::float) / 3.0);
  
  -- Kill bonus: +1 ELO per kill for winners, +0.5 per kill for losers
  v_kill_bonus := 0;
  if p_kills > 0 then
    if v_result = 'win' then
      v_kill_bonus := p_kills * 1.0;
    else
      v_kill_bonus := p_kills * 0.5;
    end if;
  end if;
  
  -- Final ELO change (base change with margin multiplier, plus kill bonus)
  v_elo_change := round(v_base_change * v_margin_multiplier + v_kill_bonus)::integer;
  v_new_elo := v_player_elo.elo + v_elo_change;
  
  -- Update player_elo table
  update public.player_elo
  set 
    elo = v_new_elo,
    games_played = player_elo.games_played + 1,
    wins = player_elo.wins + case when v_result = 'win' then 1 else 0 end,
    losses = player_elo.losses + case when v_result = 'loss' then 1 else 0 end,
    draws = player_elo.draws + case when v_result = 'draw' then 1 else 0 end
  where player_elo.game_name_lower = v_game_name_lower;
  
  -- Insert history record
  insert into public.elo_history (
    game_name_lower,
    scrim_id,
    elo_before,
    elo_after,
    elo_change,
    result,
    team_score,
    opponent_score,
    kills,
    k_factor
  ) values (
    v_game_name_lower,
    p_scrim_id,
    v_player_elo.elo,
    v_new_elo,
    v_elo_change,
    v_result,
    p_rounds_for,
    p_rounds_against,
    p_kills,
    v_k_factor
  );
  
  -- Return the result
  return query select 
    p_game_name,
    v_player_elo.elo,
    v_new_elo,
    v_elo_change,
    v_result,
    v_k_factor;
end;
$$ language plpgsql;

-- Helper function to check if a scrim has already been processed
create or replace function is_scrim_ranked(p_scrim_id uuid)
returns boolean as $$
begin
  return exists(select 1 from public.elo_history where scrim_id = p_scrim_id);
end;
$$ language plpgsql;

-- View for ELO leaderboard
create or replace view public.elo_leaderboard as
select 
  pe.game_name_lower,
  pe.game_name,
  pe.elo,
  pe.games_played,
  pe.wins,
  pe.losses,
  pe.draws,
  case when pe.games_played > 0 
    then round((pe.wins::numeric / pe.games_played::numeric) * 100, 1)
    else 0 
  end as win_rate,
  ug.user_id,
  pe.updated_at
from public.player_elo pe
left join public.user_game_names ug on pe.game_name_lower = ug.game_name_lower
order by pe.elo desc;

