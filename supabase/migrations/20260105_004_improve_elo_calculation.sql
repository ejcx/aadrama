-- Improved ELO calculation that considers individual performance
-- Players who perform well on a losing team have their loss reduced
-- Players who underperform on a winning team have their gain reduced

-- Drop the old function signature first (6 params)
DROP FUNCTION IF EXISTS process_player_elo(uuid, text, integer, integer, integer, integer);

CREATE OR REPLACE FUNCTION process_player_elo(
  p_scrim_id uuid,
  p_game_name text,
  p_rounds_for integer,
  p_rounds_against integer,
  p_kills integer default 0,
  p_opponent_avg_elo integer default 1200,
  p_team_total_kills integer default 0
) RETURNS TABLE (
  game_name text,
  elo_before integer,
  elo_after integer,
  elo_change integer,
  result text,
  k_factor integer
) AS $$
DECLARE
  v_game_name_lower text := lower(p_game_name);
  v_player_elo record;
  v_result text;
  v_expected float;
  v_actual float;
  v_k_factor integer;
  v_base_change float;
  v_margin_multiplier float;
  v_performance_modifier float;
  v_kill_contribution float;
  v_elo_change integer;
  v_new_elo integer;
BEGIN
  -- Get or create player ELO record
  SELECT * INTO v_player_elo FROM public.player_elo pe WHERE pe.game_name_lower = v_game_name_lower;
  
  IF NOT FOUND THEN
    INSERT INTO public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
    VALUES (v_game_name_lower, p_game_name, 1200, 0, 0, 0, 0)
    RETURNING * INTO v_player_elo;
  END IF;
  
  -- Determine result
  IF p_rounds_for > p_rounds_against THEN
    v_result := 'win';
  ELSIF p_rounds_for < p_rounds_against THEN
    v_result := 'loss';
  ELSE
    v_result := 'draw';
  END IF;
  
  -- Calculate K-factor based on games played
  v_k_factor := calculate_k_factor(v_player_elo.games_played);
  
  -- Calculate expected score (probability of winning)
  v_expected := calculate_expected_score(v_player_elo.elo, p_opponent_avg_elo);
  
  -- Actual score (1 for win, 0.5 for draw, 0 for loss)
  IF v_result = 'win' THEN
    v_actual := 1.0;
  ELSIF v_result = 'draw' THEN
    v_actual := 0.5;
  ELSE
    v_actual := 0.0;
  END IF;
  
  -- Base ELO change
  v_base_change := v_k_factor * (v_actual - v_expected);
  
  -- Score margin multiplier (bigger wins/losses have more impact)
  -- Reduced impact: /4.0 instead of /3.0
  v_margin_multiplier := 1.0 + (ln(1.0 + abs(p_rounds_for - p_rounds_against)::float) / 4.0);
  
  -- Performance modifier based on kill contribution
  -- Average contribution is 1/4 = 0.25 (assuming 4 players per team on average)
  -- Kill performance has significant impact on ELO changes
  v_performance_modifier := 1.0;
  v_kill_contribution := 0.0;
  
  IF p_team_total_kills > 0 THEN
    -- Calculate what % of team kills this player got
    v_kill_contribution := p_kills::float / p_team_total_kills::float;
    
    IF v_result = 'loss' THEN
      -- LOSING TEAM:
      -- High kill % = you tried to carry, significantly reduce loss
      -- Low kill % = you didn't contribute, increase loss
      IF v_kill_contribution >= 0.40 THEN
        -- Star performer (40%+ of kills): lose only 30-40% of normal
        v_performance_modifier := GREATEST(0.3, 0.7 - (v_kill_contribution - 0.40) * 2.0);
      ELSIF v_kill_contribution >= 0.25 THEN
        -- Above average (25-40%): moderate reduction
        v_performance_modifier := 1.0 - (v_kill_contribution - 0.25) * 2.0; -- 0.70 to 1.0
      ELSIF v_kill_contribution < 0.15 THEN
        -- Very low contribution (<15%): lose MORE ELO
        -- Scale: 0% -> 1.5x loss, 15% -> 1.0x loss
        v_performance_modifier := 1.5 - (v_kill_contribution / 0.15) * 0.5;
      END IF;
      -- Between 0.15 and 0.25 stays at 1.0 (average)
      
    ELSIF v_result = 'win' THEN
      -- WINNING TEAM:
      -- High kill % = you carried, get bonus ELO
      -- Low kill % = got carried, slight reduction but still positive
      IF v_kill_contribution >= 0.40 THEN
        -- Star performer (40%+ of kills): up to 60% bonus
        v_performance_modifier := LEAST(1.6, 1.3 + (v_kill_contribution - 0.40) * 1.5);
      ELSIF v_kill_contribution >= 0.30 THEN
        -- Good performer (30-40%): 10-30% bonus
        v_performance_modifier := 1.1 + (v_kill_contribution - 0.30) * 2.0;
      ELSIF v_kill_contribution < 0.10 THEN
        -- Very low contribution (<10%): reduced gains (but not punishing)
        -- Scale: 0% -> 0.7x, 10% -> 1.0x
        v_performance_modifier := 0.7 + (v_kill_contribution / 0.10) * 0.3;
      END IF;
      -- Between 0.10 and 0.30 stays at 1.0 (average)
    END IF;
  END IF;
  
  -- Final ELO change
  v_elo_change := round(v_base_change * v_margin_multiplier * v_performance_modifier)::integer;
  v_new_elo := v_player_elo.elo + v_elo_change;
  
  -- Update player_elo table
  UPDATE public.player_elo
  SET 
    elo = v_new_elo,
    games_played = player_elo.games_played + 1,
    wins = player_elo.wins + CASE WHEN v_result = 'win' THEN 1 ELSE 0 END,
    losses = player_elo.losses + CASE WHEN v_result = 'loss' THEN 1 ELSE 0 END,
    draws = player_elo.draws + CASE WHEN v_result = 'draw' THEN 1 ELSE 0 END
  WHERE player_elo.game_name_lower = v_game_name_lower;
  
  -- Insert history record
  INSERT INTO public.elo_history (
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
  ) VALUES (
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
  RETURN QUERY SELECT 
    p_game_name,
    v_player_elo.elo,
    v_new_elo,
    v_elo_change,
    v_result,
    v_k_factor;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_player_elo IS 'Calculates and applies ELO change with performance-based adjustments. Players who carry on a losing team lose less ELO.';

