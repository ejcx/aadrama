-- Store cumulative elo_before/elo_after in elo_history (for peak ELO) while Season 2
-- scrims still use season-relative rating + K-factor for the calculation itself.

CREATE OR REPLACE FUNCTION public.cumulative_elo_before_scrim(
  p_game_name_lower text,
  p_scrim_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 1200 + coalesce(sum(eh.elo_change), 0)::integer
  FROM public.elo_history eh
  WHERE eh.game_name_lower = lower(trim(p_game_name_lower))
    AND eh.scrim_id <> p_scrim_id;
$$;

CREATE OR REPLACE FUNCTION public.process_player_elo(
  p_scrim_id uuid,
  p_game_name text,
  p_rounds_for integer,
  p_rounds_against integer,
  p_kills integer DEFAULT 0,
  p_opponent_avg_elo integer DEFAULT 1200,
  p_team_total_kills integer DEFAULT 0
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
  v_games_for_k integer;
  v_effective_elo integer;
  v_cumulative_before integer;
  v_cumulative_after integer;
  v_base_change float;
  v_margin_multiplier float;
  v_performance_modifier float;
  v_kill_contribution float;
  v_elo_change integer;
BEGIN
  SELECT * INTO v_player_elo FROM public.player_elo pe WHERE pe.game_name_lower = v_game_name_lower;

  IF NOT FOUND THEN
    INSERT INTO public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
    VALUES (v_game_name_lower, p_game_name, 1200, 0, 0, 0, 0)
    RETURNING * INTO v_player_elo;
  END IF;

  v_cumulative_before := public.cumulative_elo_before_scrim(v_game_name_lower, p_scrim_id);

  IF is_season_2_scrim(p_scrim_id) THEN
    v_effective_elo := season_2_elo_before_scrim(v_game_name_lower, p_scrim_id);
    v_games_for_k := season_2_games_before_scrim(v_game_name_lower, p_scrim_id);
  ELSE
    v_effective_elo := v_player_elo.elo;
    v_games_for_k := v_player_elo.games_played;
  END IF;

  IF p_rounds_for > p_rounds_against THEN
    v_result := 'win';
  ELSIF p_rounds_for < p_rounds_against THEN
    v_result := 'loss';
  ELSE
    v_result := 'draw';
  END IF;

  v_k_factor := calculate_k_factor(v_games_for_k);
  v_expected := calculate_expected_score(v_effective_elo, p_opponent_avg_elo);

  IF v_result = 'win' THEN
    v_actual := 1.0;
  ELSIF v_result = 'draw' THEN
    v_actual := 0.5;
  ELSE
    v_actual := 0.0;
  END IF;

  v_base_change := v_k_factor * (v_actual - v_expected);
  v_margin_multiplier := 1.0 + (ln(1.0 + abs(p_rounds_for - p_rounds_against)::float) / 4.0);
  v_performance_modifier := 1.0;
  v_kill_contribution := 0.0;

  IF p_team_total_kills > 0 THEN
    v_kill_contribution := p_kills::float / p_team_total_kills::float;

    IF v_result = 'loss' THEN
      IF v_kill_contribution >= 0.40 THEN
        v_performance_modifier := GREATEST(0.3, 0.7 - (v_kill_contribution - 0.40) * 2.0);
      ELSIF v_kill_contribution >= 0.25 THEN
        v_performance_modifier := 1.0 - (v_kill_contribution - 0.25) * 2.0;
      ELSIF v_kill_contribution < 0.15 THEN
        v_performance_modifier := 1.5 - (v_kill_contribution / 0.15) * 0.5;
      END IF;
    ELSIF v_result = 'win' THEN
      IF v_kill_contribution >= 0.40 THEN
        v_performance_modifier := LEAST(1.6, 1.3 + (v_kill_contribution - 0.40) * 1.5);
      ELSIF v_kill_contribution >= 0.30 THEN
        v_performance_modifier := 1.1 + (v_kill_contribution - 0.30) * 2.0;
      ELSIF v_kill_contribution < 0.10 THEN
        v_performance_modifier := 0.7 + (v_kill_contribution / 0.10) * 0.3;
      END IF;
    END IF;
  END IF;

  v_elo_change := round(v_base_change * v_margin_multiplier * v_performance_modifier)::integer;
  v_cumulative_after := v_cumulative_before + v_elo_change;

  UPDATE public.player_elo
  SET
    elo = player_elo.elo + v_elo_change,
    games_played = player_elo.games_played + 1,
    wins = player_elo.wins + CASE WHEN v_result = 'win' THEN 1 ELSE 0 END,
    losses = player_elo.losses + CASE WHEN v_result = 'loss' THEN 1 ELSE 0 END,
    draws = player_elo.draws + CASE WHEN v_result = 'draw' THEN 1 ELSE 0 END
  WHERE player_elo.game_name_lower = v_game_name_lower;

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
    v_cumulative_before,
    v_cumulative_after,
    v_elo_change,
    v_result,
    p_rounds_for,
    p_rounds_against,
    p_kills,
    v_k_factor
  );

  RETURN QUERY SELECT
    p_game_name,
    v_cumulative_before,
    v_cumulative_after,
    v_elo_change,
    v_result,
    v_k_factor;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.process_player_elo IS
  'Ranked ELO for one scrim. S2 uses season game count + season rating for math; elo_history always stores cumulative before/after for peak ELO.';
