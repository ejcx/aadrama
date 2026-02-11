-- ELO-balanced team assignment with punitive matchmaking for hill and will
-- If both hill and will are playing, they are forced together on the same team
-- with the single lowest ELO player, and the 4th player is chosen by the algorithm
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
  
  -- Check if hill and will are both present (using EXISTS for reliable boolean check)
  SELECT 
    EXISTS(SELECT 1 FROM public.scrim_players WHERE scrim_id = p_scrim_id AND is_ready = TRUE AND user_id = hill_user_id),
    EXISTS(SELECT 1 FROM public.scrim_players WHERE scrim_id = p_scrim_id AND is_ready = TRUE AND user_id = will_user_id)
  INTO hill_present, will_present;
  
  half_count := player_count / 2;
  
  -- If both hill and will are present, apply punitive matchmaking
  IF hill_present AND will_present THEN
    -- Strategy: 
    -- 1. Assign hill and will to team_a
    -- 2. Assign the single lowest ELO player to team_a (if there's room)
    -- 3. Use snake draft algorithm on remaining players to fill team_a to half_count
    -- 4. Assign all other remaining players to team_b
    
    -- Ensure we have at least 4 players (hill, will, and 2 others minimum)
    IF player_count < 4 THEN
      RAISE EXCEPTION 'Cannot assign teams with hill and will: need at least 4 players, got %', player_count;
    END IF;
    
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
        ROW_NUMBER() OVER (ORDER BY elo ASC, random()) as rank_asc,
        ROW_NUMBER() OVER (ORDER BY elo DESC, random()) as rank_desc
      FROM player_elos
    ),
    lowest_one AS (
      SELECT player_id
      FROM ranked_others
      WHERE rank_asc = 1
    ),
    snake_draft_precalc AS (
      SELECT 
        player_id,
        elo,
        rank_desc,
        -- Apply snake draft pattern to all remaining players
        CASE 
          WHEN ((rank_desc - 1) / 2) % 2 = 0 THEN
            CASE WHEN (rank_desc - 1) % 2 = 0 THEN 'team_a' ELSE 'team_b' END
          ELSE
            CASE WHEN (rank_desc - 1) % 2 = 0 THEN 'team_b' ELSE 'team_a' END
        END as snake_team
      FROM ranked_others
      WHERE rank_asc > 1  -- Exclude the lowest one (will be assigned separately)
    ),
    snake_draft_assignments AS (
      SELECT 
        player_id,
        elo,
        rank_desc,
        snake_team,
        -- Create a global ordering: prioritize players snake draft assigned to team_a, then by ELO rank
        ROW_NUMBER() OVER (ORDER BY 
          CASE WHEN snake_team = 'team_a' THEN 0 ELSE 1 END,  -- team_a players first
          rank_desc  -- then by ELO rank (descending, so higher ELO first)
        ) as global_rank
      FROM snake_draft_precalc
    ),
    final_assignments AS (
      SELECT 
        player_id,
        CASE 
          WHEN half_count > 2 AND (half_count - 3) > 0 THEN
            -- Team_a needs exactly (half_count - 3) more players
            -- Take the first (half_count - 3) players in global order (prioritizing snake_draft team_a assignments)
            CASE 
              WHEN global_rank <= (half_count - 3) THEN 'team_a'
              ELSE 'team_b'
            END
          ELSE
            -- half_count = 2, team_a is full with just hill+will, all remaining go to team_b
            'team_b'
        END as team
      FROM snake_draft_assignments
    )
    -- First, assign hill and will to team_a
    UPDATE public.scrim_players
    SET team = 'team_a'
    WHERE scrim_id = p_scrim_id 
      AND is_ready = TRUE
      AND user_id IN (hill_user_id, will_user_id);
    
    -- Assign the single lowest ELO player to team_a (only if there's room)
    IF half_count > 2 THEN
      UPDATE public.scrim_players
      SET team = 'team_a'
      FROM lowest_one lo
      WHERE scrim_players.id = lo.player_id;
    END IF;
    
    -- Assign remaining players using snake draft algorithm
    UPDATE public.scrim_players sp
    SET team = fa.team
    FROM final_assignments fa
    WHERE sp.id = fa.player_id;
    
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

COMMENT ON FUNCTION assign_balanced_teams IS 'Assigns teams balanced by ELO using snake draft. If hill and will are both playing, they are forced together on the same team with the single lowest ELO player, and the remaining slots are filled by the algorithm';
COMMENT ON FUNCTION assign_purely_random_teams IS 'Assigns teams purely randomly without ELO balancing - used for rerolls';
