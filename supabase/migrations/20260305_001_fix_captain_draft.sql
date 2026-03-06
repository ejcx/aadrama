-- Fix captain draft function to provide better error messages and validation
-- Date: 2026-03-05

CREATE OR REPLACE FUNCTION start_captain_draft(p_scrim_id UUID)
RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_captain_a_id TEXT;
  v_captain_b_id TEXT;
  v_updated_count INTEGER;
BEGIN
  -- Get scrim details
  SELECT status, captain_a_user_id, captain_b_user_id
  INTO v_status, v_captain_a_id, v_captain_b_id
  FROM public.scrims
  WHERE id = p_scrim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scrim % not found', p_scrim_id;
  END IF;

  -- Verify captains are set
  IF v_captain_a_id IS NULL OR v_captain_b_id IS NULL THEN
    RAISE EXCEPTION 'Both captains must be set before starting draft. Creator needs to select captains first.';
  END IF;

  -- Verify status is 'waiting'
  IF v_status != 'waiting' THEN
    RAISE EXCEPTION 'Cannot start draft: scrim status is % (must be waiting)', v_status;
  END IF;

  -- Move to drafting status
  UPDATE public.scrims
  SET status = 'drafting',
      current_drafter = 'captain_a',
      draft_position = 0,
      ready_check_at = NOW()
  WHERE id = p_scrim_id AND status = 'waiting';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Failed to update scrim status to drafting (scrim may have already started)';
  END IF;

  -- Assign captains to their teams
  UPDATE public.scrim_players
  SET team = 'team_a'
  WHERE scrim_id = p_scrim_id
  AND user_id = v_captain_a_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Captain A (user_id: %) is not a player in this scrim', v_captain_a_id;
  END IF;

  UPDATE public.scrim_players
  SET team = 'team_b'
  WHERE scrim_id = p_scrim_id
  AND user_id = v_captain_b_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Captain B (user_id: %) is not a player in this scrim', v_captain_b_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
