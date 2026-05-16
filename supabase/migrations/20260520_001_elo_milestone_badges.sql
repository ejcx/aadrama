-- ELO milestone badges: 1350, 1400, 1450 (first time reaching each rating after a ranked game).
-- session_id elo-milestone-{threshold} keeps awards idempotent.

CREATE OR REPLACE FUNCTION public.try_award_elo_milestone_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_name text;
BEGIN
  SELECT pe.game_name
  INTO v_game_name
  FROM public.player_elo pe
  WHERE pe.game_name_lower = NEW.game_name_lower;

  IF NEW.elo_after >= 1350 THEN
    INSERT INTO public.player_badges (
      badge_type,
      game_name,
      game_name_lower,
      session_id,
      earned_at
    )
    VALUES (
      'elo_milestone_1350',
      coalesce(v_game_name, NEW.game_name_lower),
      NEW.game_name_lower,
      'elo-milestone-1350',
      NEW.created_at
    )
    ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;
  END IF;

  IF NEW.elo_after >= 1400 THEN
    INSERT INTO public.player_badges (
      badge_type,
      game_name,
      game_name_lower,
      session_id,
      earned_at
    )
    VALUES (
      'elo_milestone_1400',
      coalesce(v_game_name, NEW.game_name_lower),
      NEW.game_name_lower,
      'elo-milestone-1400',
      NEW.created_at
    )
    ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;
  END IF;

  IF NEW.elo_after >= 1450 THEN
    INSERT INTO public.player_badges (
      badge_type,
      game_name,
      game_name_lower,
      session_id,
      earned_at
    )
    VALUES (
      'elo_milestone_1450',
      coalesce(v_game_name, NEW.game_name_lower),
      NEW.game_name_lower,
      'elo-milestone-1450',
      NEW.created_at
    )
    ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.try_award_elo_milestone_badges() IS
  'Awards elo_milestone_1350/1400/1450 when elo_after reaches each threshold.';

DROP TRIGGER IF EXISTS award_elo_milestone_badges_on_elo_history ON public.elo_history;

CREATE TRIGGER award_elo_milestone_badges_on_elo_history
  AFTER INSERT ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.try_award_elo_milestone_badges();

-- Historical backfill: first ranked game where the player reached each threshold.
INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'elo_milestone_1350',
  coalesce(pe.game_name, m.game_name_lower),
  m.game_name_lower,
  'elo-milestone-1350',
  m.earned_at
FROM (
  SELECT
    eh.game_name_lower,
    min(eh.created_at) AS earned_at
  FROM public.elo_history eh
  WHERE eh.elo_after >= 1350
  GROUP BY eh.game_name_lower
) m
LEFT JOIN public.player_elo pe ON pe.game_name_lower = m.game_name_lower
ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;

INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'elo_milestone_1400',
  coalesce(pe.game_name, m.game_name_lower),
  m.game_name_lower,
  'elo-milestone-1400',
  m.earned_at
FROM (
  SELECT
    eh.game_name_lower,
    min(eh.created_at) AS earned_at
  FROM public.elo_history eh
  WHERE eh.elo_after >= 1400
  GROUP BY eh.game_name_lower
) m
LEFT JOIN public.player_elo pe ON pe.game_name_lower = m.game_name_lower
ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;

INSERT INTO public.player_badges (
  badge_type,
  game_name,
  game_name_lower,
  session_id,
  earned_at
)
SELECT
  'elo_milestone_1450',
  coalesce(pe.game_name, m.game_name_lower),
  m.game_name_lower,
  'elo-milestone-1450',
  m.earned_at
FROM (
  SELECT
    eh.game_name_lower,
    min(eh.created_at) AS earned_at
  FROM public.elo_history eh
  WHERE eh.elo_after >= 1450
  GROUP BY eh.game_name_lower
) m
LEFT JOIN public.player_elo pe ON pe.game_name_lower = m.game_name_lower
ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;
