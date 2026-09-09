-- Overwrite the wrong team-A +10 run for scrim 7892c43d-62ce-4064-b8a6-6d6773b08342.
-- Reverses existing elo_history for this scrim, then applies team B +10 / team A -10.

DO $$
DECLARE
  v_scrim_id uuid := '7892c43d-62ce-4064-b8a6-6d6773b08342';
  v_team_a integer;
  v_team_b integer;
  v_reversed integer := 0;
  v_applied integer := 0;
  r record;
  v_before integer;
  v_change integer;
  v_result text;
  v_names text[] := ARRAY[]::text[];
BEGIN
  SELECT coalesce(s.team_a_score, 0), coalesce(s.team_b_score, 1)
  INTO v_team_a, v_team_b
  FROM public.scrims s
  WHERE s.id = v_scrim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim % not found', v_scrim_id;
  END IF;

  FOR r IN
    SELECT eh.game_name_lower, eh.elo_change, eh.result
    FROM public.elo_history eh
    WHERE eh.scrim_id = v_scrim_id
  LOOP
    UPDATE public.player_elo pe
    SET
      elo = pe.elo - r.elo_change,
      games_played = greatest(pe.games_played - 1, 0),
      wins = greatest(pe.wins - CASE WHEN r.result = 'win' THEN 1 ELSE 0 END, 0),
      losses = greatest(pe.losses - CASE WHEN r.result = 'loss' THEN 1 ELSE 0 END, 0),
      draws = greatest(pe.draws - CASE WHEN r.result = 'draw' THEN 1 ELSE 0 END, 0)
    WHERE pe.game_name_lower = r.game_name_lower;

    v_names := array_append(v_names, r.game_name_lower);
    v_reversed := v_reversed + 1;
    RAISE NOTICE 'Reversed % (% %+%)', r.game_name_lower, r.result, CASE WHEN r.elo_change >= 0 THEN '+' ELSE '' END, r.elo_change;
  END LOOP;

  DELETE FROM public.elo_history eh
  WHERE eh.scrim_id = v_scrim_id;

  RAISE NOTICE 'Removed % elo_history row(s) for scrim %', v_reversed, v_scrim_id;

  FOR r IN
    SELECT DISTINCT ON (sp.user_id)
      COALESCE(ugn.game_name, sp.user_name) AS game_name,
      COALESCE(ugn.game_name_lower, lower(trim(sp.user_name))) AS game_name_lower,
      sp.team
    FROM public.scrim_players sp
    LEFT JOIN LATERAL (
      SELECT ugn.game_name, ugn.game_name_lower
      FROM public.user_game_names ugn
      WHERE ugn.user_id = sp.user_id
      ORDER BY ugn.created_at ASC
      LIMIT 1
    ) ugn ON true
    WHERE sp.scrim_id = v_scrim_id
      AND sp.team IN ('team_a', 'team_b')
    ORDER BY sp.user_id
  LOOP
    IF r.team = 'team_b' THEN
      v_change := 10;
      v_result := 'win';
    ELSE
      v_change := -10;
      v_result := 'loss';
    END IF;

    INSERT INTO public.player_elo (game_name_lower, game_name, elo, games_played, wins, losses, draws)
    VALUES (r.game_name_lower, r.game_name, 1200, 0, 0, 0, 0)
    ON CONFLICT (game_name_lower) DO NOTHING;

    v_before := public.cumulative_elo_before_scrim(r.game_name_lower, v_scrim_id);

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
      r.game_name_lower,
      v_scrim_id,
      v_before,
      v_before + v_change,
      v_change,
      v_result,
      CASE WHEN r.team = 'team_a' THEN v_team_a ELSE v_team_b END,
      CASE WHEN r.team = 'team_a' THEN v_team_b ELSE v_team_a END,
      0,
      10
    );

    UPDATE public.player_elo pe
    SET
      elo = pe.elo + v_change,
      games_played = pe.games_played + 1,
      wins = pe.wins + CASE WHEN v_result = 'win' THEN 1 ELSE 0 END,
      losses = pe.losses + CASE WHEN v_result = 'loss' THEN 1 ELSE 0 END
    WHERE pe.game_name_lower = r.game_name_lower;

    v_names := array_append(v_names, r.game_name_lower);
    v_applied := v_applied + 1;
    RAISE NOTICE '% % (%): % -> %',
      r.game_name,
      v_result,
      r.team,
      v_before,
      v_before + v_change;
  END LOOP;

  IF v_applied = 0 THEN
    RAISE EXCEPTION 'Scrim % has no team-assigned players', v_scrim_id;
  END IF;

  UPDATE public.scrims
  SET ranked_processed_at = now()
  WHERE id = v_scrim_id;

  PERFORM public.rebuild_cumulative_elo_history_for_players(v_names);

  RAISE NOTICE 'Overwrite complete: reversed %, applied team B +10 / team A -10 to % players',
    v_reversed, v_applied;
END $$;
