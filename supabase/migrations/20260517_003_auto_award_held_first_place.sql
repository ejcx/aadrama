-- Auto-award held_first_place when a player reaches global ELO #1 (including ties).

CREATE OR REPLACE FUNCTION public.try_award_held_first_place_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_name text;
  v_higher_count integer;
BEGIN
  SELECT count(*)::integer
  INTO v_higher_count
  FROM public.player_elo
  WHERE elo > NEW.elo_after;

  IF v_higher_count > 0 THEN
    RETURN NEW;
  END IF;

  SELECT pe.game_name
  INTO v_game_name
  FROM public.player_elo pe
  WHERE pe.game_name_lower = NEW.game_name_lower;

  INSERT INTO public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  VALUES (
    'held_first_place',
    coalesce(v_game_name, NEW.game_name_lower),
    NEW.game_name_lower,
    'held-first-place',
    NEW.created_at
  )
  ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_held_first_place_on_elo_history ON public.elo_history;

CREATE TRIGGER award_held_first_place_on_elo_history
  AFTER INSERT ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.try_award_held_first_place_badge();

COMMENT ON FUNCTION public.try_award_held_first_place_badge() IS
  'Awards held_first_place badge when a player elo_after ties or takes global #1.';
