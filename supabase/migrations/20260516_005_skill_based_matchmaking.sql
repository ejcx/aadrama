-- Skill-based matchmaking: 50% ELO snake draft, 50% avg kills/scrim snake draft.
-- Replaces elo_balanced selection mode with skill_based.

UPDATE public.scrims
SET selection_mode = 'skill_based'
WHERE selection_mode = 'elo_balanced';

ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_selection_mode_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_selection_mode_check
CHECK (selection_mode IN ('random', 'skill_based', 'captains'));

-- Snake draft by average kills per finalized scrim (player_scrim_stats_mv).
-- Logic mirrored in lib/scrim/matchmaking.ts (assignKillsBalancedTeams).
CREATE OR REPLACE FUNCTION assign_kills_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF player_count < 8 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', player_count;
  END IF;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)', player_count;
  END IF;

  WITH player_kills AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      CASE
        WHEN COALESCE(pss.total_scrims, 0) > 0
        THEN COALESCE(pss.total_scrim_kills, 0)::numeric / pss.total_scrims
        ELSE 0
      END AS avg_kills
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_scrim_stats_mv pss ON pss.player_name_lower = ugn.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, avg_kills DESC NULLS LAST
  ),
  ranked_players AS (
    SELECT
      player_id,
      ROW_NUMBER() OVER (ORDER BY avg_kills DESC, random()) AS rn
    FROM player_kills
  )
  UPDATE public.scrim_players sp
  SET team = CASE
    WHEN ((rp.rn - 1) / 2) % 2 = 0 THEN
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
    ELSE
      CASE WHEN (rp.rn - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
    END
  FROM ranked_players rp
  WHERE sp.id = rp.player_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- 50/50 ELO or kills-balanced snake draft (skill_based selection mode).
CREATE OR REPLACE FUNCTION assign_skill_based_teams(p_scrim_id UUID)
RETURNS VOID AS $$
BEGIN
  IF random() < 0.5 THEN
    PERFORM assign_elo_balanced_teams(p_scrim_id);
  ELSE
    PERFORM assign_kills_balanced_teams(p_scrim_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_kills_balanced_teams IS 'Snake draft by avg kills per scrim (player_scrim_stats_mv); 50/50 split';
COMMENT ON FUNCTION assign_skill_based_teams IS 'Skill-based: 50% ELO snake draft, 50% avg kills/scrim snake draft';
