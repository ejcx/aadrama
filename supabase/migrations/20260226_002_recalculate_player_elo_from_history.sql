-- Rebuild one player's player_elo from elo_history (by game_name_lower).
-- Current ELO = elo_after from the most recent history row; games/wins/losses/draws = counts from history.

CREATE OR REPLACE FUNCTION recalculate_player_elo_from_history(p_game_name_lower text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH aggregated AS (
    SELECT
      game_name_lower,
      (array_agg(elo_after ORDER BY created_at DESC))[1] AS elo,
      count(*)::integer AS games_played,
      count(*) FILTER (WHERE result = 'win')::integer AS wins,
      count(*) FILTER (WHERE result = 'loss')::integer AS losses,
      count(*) FILTER (WHERE result = 'draw')::integer AS draws
    FROM public.elo_history
    WHERE game_name_lower = lower(trim(p_game_name_lower))
    GROUP BY game_name_lower
  )
  INSERT INTO public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
  SELECT
    a.game_name_lower,
    coalesce(pe.game_name, a.game_name_lower),
    a.elo,
    a.games_played,
    a.wins,
    a.losses,
    a.draws
  FROM aggregated a
  LEFT JOIN public.player_elo pe ON pe.game_name_lower = a.game_name_lower
  ON CONFLICT (game_name_lower) DO UPDATE SET
    elo = excluded.elo,
    games_played = excluded.games_played,
    wins = excluded.wins,
    losses = excluded.losses,
    draws = excluded.draws;
$$;

COMMENT ON FUNCTION recalculate_player_elo_from_history(text) IS
  'Rebuilds one player_elo row from elo_history for the given game_name_lower. No-op if player has no history.';
