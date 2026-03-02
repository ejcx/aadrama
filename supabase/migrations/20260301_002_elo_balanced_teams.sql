-- Migration: Add ELO-balanced team assignment
-- Date: 2026-03-01

-- Update selection_mode to include 'elo_balanced'
ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_selection_mode_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_selection_mode_check
CHECK (selection_mode IN ('random', 'elo_balanced', 'captains'));

-- Create function to assign ELO-balanced teams
-- Uses a greedy algorithm: sort by ELO, alternate assignment to balance teams
CREATE OR REPLACE FUNCTION assign_elo_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)', player_count;
  END IF;

  half_count := player_count / 2;

  -- Get players with their ELO ratings (from user_game_names -> player_elo)
  -- For players without linked game names, use default ELO of 1200
  WITH player_elos AS (
    SELECT
      sp.id as player_id,
      sp.user_id,
      sp.user_name,
      COALESCE(pe.elo, 1200) as elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_elo pe ON pe.game_name_lower = ugn.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
  ),
  -- Sort by ELO descending and assign alternating teams
  -- Pattern: A, B, B, A, A, B, B, A (snake draft pattern for fairness)
  ranked_players AS (
    SELECT
      player_id,
      elo,
      ROW_NUMBER() OVER (ORDER BY elo DESC, user_id) as rn
    FROM player_elos
  )
  UPDATE public.scrim_players sp
  SET team = CASE
    -- Snake pattern: round 0 (pos 0-1): A,B | round 1 (pos 2-3): B,A | round 2 (pos 4-5): A,B
    WHEN ((rp.rn - 1) / 2) % 2 = 0 THEN
      -- Even round: A, B pattern
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
    ELSE
      -- Odd round: B, A pattern
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
    END
  FROM ranked_players rp
  WHERE sp.id = rp.player_id;

  -- Start the game
  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- Done!
