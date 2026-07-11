-- Skill-based matchmaking: 100 random 50/50 splits, pick lowest |sum(ELO_A) − sum(ELO_B)|.
-- Superseded by 20260529_002_fix_elo_optimized_team_assignment.sql (set-based + SECURITY DEFINER).
-- Kept for migration history; 002 replaces the function body if 001 was already applied.

CREATE OR REPLACE FUNCTION assign_elo_optimized_random_teams(p_scrim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.scrims
    WHERE id = p_scrim_id AND status <> 'waiting'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF player_count < 8 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 8 players (4v4), got %', player_count;
  END IF;

  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: odd number of players (%)', player_count;
  END IF;

  half_count := player_count / 2;

  WITH player_elos AS (
    SELECT DISTINCT ON (sp.id)
      sp.id AS player_id,
      COALESCE(pe.elo, 1200)::BIGINT AS elo
    FROM public.scrim_players sp
    LEFT JOIN public.user_game_names ugn ON ugn.user_id = sp.user_id
    LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
    WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
    ORDER BY sp.id, pe.elo DESC NULLS LAST
  ),
  attempts AS (
    SELECT
      gs.attempt_num,
      pe.player_id,
      pe.elo,
      ROW_NUMBER() OVER (PARTITION BY gs.attempt_num ORDER BY random()) AS rn
    FROM player_elos pe
    CROSS JOIN generate_series(1, 100) AS gs(attempt_num)
  ),
  attempt_diffs AS (
    SELECT
      attempt_num,
      ABS(
        COALESCE(SUM(elo) FILTER (WHERE rn <= half_count), 0)
        - COALESCE(SUM(elo) FILTER (WHERE rn > half_count), 0)
      ) AS diff
    FROM attempts
    GROUP BY attempt_num
  ),
  best_attempt AS (
    SELECT attempt_num
    FROM attempt_diffs
    ORDER BY diff ASC, attempt_num ASC
    LIMIT 1
  ),
  best_teams AS (
    SELECT
      a.player_id,
      CASE WHEN a.rn <= half_count THEN 'team_a' ELSE 'team_b' END AS team
    FROM attempts a
    INNER JOIN best_attempt b ON a.attempt_num = b.attempt_num
  )
  UPDATE public.scrim_players sp
  SET team = bt.team
  FROM best_teams bt
  WHERE sp.id = bt.player_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;

  IF team_a_count IS DISTINCT FROM half_count OR team_b_count IS DISTINCT FROM half_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;

  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id AND status = 'waiting';
END;
$$;

CREATE OR REPLACE FUNCTION assign_skill_based_teams(p_scrim_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assign_elo_optimized_random_teams(p_scrim_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_elo_optimized_random_teams(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_skill_based_teams(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION assign_elo_optimized_random_teams IS '100 random 50/50 splits; lowest |sum(ELO_A) − sum(ELO_B)|; idempotent; SECURITY DEFINER';
COMMENT ON FUNCTION assign_skill_based_teams IS 'Skill-based: ELO-optimized random team search (100 trials)';
COMMENT ON FUNCTION assign_kills_balanced_teams IS 'Deprecated: was kills snake draft; skill_based now uses assign_elo_optimized_random_teams';
