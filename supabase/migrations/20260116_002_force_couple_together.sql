-- ELO-balanced team assignment with punitive matchmaking for hill and will
-- If both hill and will are playing, they are forced together on the same team
-- and automatically matched with the two lowest ELO players (even at expense of ELO fairness)
CREATE OR REPLACE FUNCTION assign_balanced_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
  hill_user_id TEXT := 'user_380DgIMpLjUUQxcA5xWU3n0BVdG';
  will_user_id TEXT := 'user_38EICdNLgmJal6JCh81z1ALjWqF';
  hill_present BOOLEAN;
  will_present BOOLEAN;
  punitive_team TEXT;
BEGIN
  -- Get count of ready players
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;
  
  -- Must have even number of players (minimum 2)
  IF player_count < 2 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 2 players, got %', player_count;
  END IF;
  
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;
  
  -- Check if hill and will are both present
  SELECT 
    COUNT(*) FILTER (WHERE user_id = hill_user_id) > 0,
    COUNT(*) FILTER (WHERE user_id = will_user_id) > 0
  INTO hill_present, will_present
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;
  
  half_count := player_count / 2;
  
  -- If both hill and will are present, apply punitive matchmaking
  IF hill_present AND will_present THEN
    -- Assign punitive team (team_a) to hill, will, and the two lowest ELO players
    WITH player_elos AS (
      SELECT DISTINCT ON (sp.id)
        sp.id as player_id,
        sp.user_id,
        COALESCE(pe.elo, 1200) as elo
      FROM public.scrim_players sp
      LEFT JOIN public.user_game_names ugn ON sp.user_id = ugn.user_id
      LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
      WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
        AND sp.user_id NOT IN (hill_user_id, will_user_id)
      ORDER BY sp.id, pe.elo DESC NULLS LAST
    ),
    ranked_others AS (
      SELECT 
        player_id,
        elo,
        ROW_NUMBER() OVER (ORDER BY elo ASC, random()) as rank_asc
      FROM player_elos
    ),
    lowest_two AS (
      SELECT player_id
      FROM ranked_others
      WHERE rank_asc <= 2
    )
    -- First, assign hill and will to team_a (punitive team)
    UPDATE public.scrim_players
    SET team = 'team_a'
    WHERE scrim_id = p_scrim_id 
      AND is_ready = TRUE
      AND user_id IN (hill_user_id, will_user_id);
    
    -- Then assign the two lowest ELO players to team_a as well
    UPDATE public.scrim_players
    SET team = 'team_a'
    FROM lowest_two lt
    WHERE scrim_players.id = lt.player_id;
    
    -- Assign all remaining players to team_b to balance teams
    -- (team_a already has hill, will, and the 2 lowest ELO players = 4 players)
    UPDATE public.scrim_players
    SET team = 'team_b'
    WHERE scrim_id = p_scrim_id 
      AND is_ready = TRUE
      AND team IS NULL;
    
  ELSE
    -- Normal ELO-balanced snake draft (no hill/will present)
    WITH player_elos AS (
      SELECT DISTINCT ON (sp.id)
        sp.id as player_id,
        sp.user_id,
        COALESCE(pe.elo, 1200) as elo
      FROM public.scrim_players sp
      LEFT JOIN public.user_game_names ugn ON sp.user_id = ugn.user_id
      LEFT JOIN public.player_elo pe ON ugn.game_name_lower = pe.game_name_lower
      WHERE sp.scrim_id = p_scrim_id AND sp.is_ready = TRUE
      ORDER BY sp.id, pe.elo DESC NULLS LAST
    ),
    ranked_players AS (
      SELECT 
        player_id,
        elo,
        ROW_NUMBER() OVER (ORDER BY elo DESC, random()) as rank
      FROM player_elos
    ),
    team_assignments AS (
      SELECT
        player_id,
        elo,
        rank,
        -- Snake draft pattern: 1-A, 2-B, 3-B, 4-A, 5-A, 6-B, 7-B, 8-A...
        CASE 
          WHEN ((rank - 1) / 2) % 2 = 0 THEN
            CASE WHEN (rank - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
          ELSE
            CASE WHEN (rank - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
        END as team
      FROM ranked_players
    )
    UPDATE public.scrim_players sp
    SET team = ta.team
    FROM team_assignments ta
    WHERE sp.id = ta.player_id;
  END IF;
  
  -- Verify teams are even (safety check)
  SELECT 
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND is_ready = TRUE;
  
  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;
  
  -- Update scrim status to in_progress
  UPDATE public.scrims
  SET status = 'in_progress',
      started_at = NOW()
  WHERE id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

-- Restore original random team assignment (removed couple constraint)
CREATE OR REPLACE FUNCTION assign_purely_random_teams(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  player_count INTEGER;
  half_count INTEGER;
  team_a_count INTEGER;
  team_b_count INTEGER;
BEGIN
  -- Get count of players in the scrim (they should all have teams already)
  SELECT COUNT(*) INTO player_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  -- Must have even number of players
  IF player_count < 2 THEN
    RAISE EXCEPTION 'Cannot assign teams: need at least 2 players, got %', player_count;
  END IF;
  
  IF player_count % 2 != 0 THEN
    RAISE EXCEPTION 'Cannot assign teams: must have even number of players (got %)', player_count;
  END IF;
  
  half_count := player_count / 2;
  
  -- Randomly assign teams using ORDER BY random()
  WITH shuffled AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY random()) as rn
    FROM public.scrim_players
    WHERE scrim_id = p_scrim_id AND team IS NOT NULL
  )
  UPDATE public.scrim_players sp
  SET team = CASE 
    WHEN s.rn <= half_count THEN 'team_a'
    ELSE 'team_b'
  END
  FROM shuffled s
  WHERE sp.id = s.id;
  
  -- Verify teams are even (safety check)
  SELECT 
    COUNT(*) FILTER (WHERE team = 'team_a'),
    COUNT(*) FILTER (WHERE team = 'team_b')
  INTO team_a_count, team_b_count
  FROM public.scrim_players
  WHERE scrim_id = p_scrim_id AND team IS NOT NULL;
  
  IF team_a_count != team_b_count THEN
    RAISE EXCEPTION 'Team assignment failed: uneven teams (% vs %)', team_a_count, team_b_count;
  END IF;
  
  -- Reset all reroll votes after successful reroll
  UPDATE public.scrim_players
  SET voted_reroll = FALSE
  WHERE scrim_id = p_scrim_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION assign_balanced_teams IS 'Assigns teams balanced by ELO using snake draft. If hill and will are both playing, they are forced together on the same team with the two lowest ELO players (punitive matchmaking)';
COMMENT ON FUNCTION assign_purely_random_teams IS 'Assigns teams purely randomly without ELO balancing - used for rerolls';
