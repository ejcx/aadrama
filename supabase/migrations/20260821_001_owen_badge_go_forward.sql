-- Auto-award "owen" badge for 0 kills in a finalized ranked scrim.
-- Go-forward only: finalized_at on or after 2026-08-21 UTC (matches app OWEN_BADGE_GO_FORWARD_CUTOFF).
-- Does NOT backfill historical 0-kill games.
-- Idempotent via unique_player_badge_per_session.

CREATE OR REPLACE FUNCTION public.award_owen_badges(p_scrim_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim record;
  v_inserted integer := 0;
  v_owen_go_forward timestamptz := '2026-08-21T00:00:00+00'::timestamptz;
BEGIN
  SELECT id, status, finalized_at, tracker_session_id, is_ranked
  INTO v_scrim
  FROM public.scrims
  WHERE id = p_scrim_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Go-forward only: never award for older finalized scrims
  IF v_scrim.status <> 'finalized'
     OR v_scrim.finalized_at IS NULL
     OR v_scrim.finalized_at < v_owen_go_forward
     OR coalesce(v_scrim.is_ranked, false) = false
     OR v_scrim.tracker_session_id IS NULL
     OR trim(v_scrim.tracker_session_id) = '' THEN
    RETURN 0;
  END IF;

  WITH scrim_sessions AS (
    SELECT trim(sid) AS session_id
    FROM regexp_split_to_table(v_scrim.tracker_session_id, '[+~\s]+') AS sid
    WHERE trim(sid) <> ''
  ),
  scrim_participants AS (
    SELECT DISTINCT ON (sp.user_id)
      sp.user_id,
      sp.user_name,
      ugn.game_name_lower
    FROM public.scrim_players sp
    LEFT JOIN LATERAL (
      SELECT u.game_name_lower
      FROM public.user_game_names u
      WHERE u.user_id = sp.user_id
      ORDER BY u.created_at ASC
      LIMIT 1
    ) ugn ON true
    WHERE sp.scrim_id = p_scrim_id
  ),
  participant_kills AS (
    SELECT
      coalesce(sp.game_name_lower, lower(sp.user_name)) AS game_name_lower,
      coalesce(
        (
          SELECT ps.name
          FROM public.player_stats ps
          INNER JOIN scrim_sessions ss ON ps.session_id = ss.session_id
          WHERE lower(ps.name) = coalesce(sp.game_name_lower, lower(sp.user_name))
          ORDER BY ps.time DESC NULLS LAST
          LIMIT 1
        ),
        sp.user_name
      ) AS game_name,
      coalesce(
        (
          SELECT sum(ps.kills)::integer
          FROM public.player_stats ps
          INNER JOIN scrim_sessions ss ON ps.session_id = ss.session_id
          WHERE lower(ps.name) = coalesce(sp.game_name_lower, lower(sp.user_name))
        ),
        0
      ) AS kills
    FROM scrim_participants sp
  )
  INSERT INTO public.player_badges (
    badge_type,
    game_name,
    game_name_lower,
    session_id,
    earned_at
  )
  SELECT
    'owen',
    pk.game_name,
    pk.game_name_lower,
    p_scrim_id::text,
    v_scrim.finalized_at
  FROM participant_kills pk
  WHERE pk.kills = 0
  ON CONFLICT ON CONSTRAINT unique_player_badge_per_session DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.award_owen_badges(uuid) IS
  'Awards owen badge to ranked-scrim participants with 0 kills. Go-forward from 2026-08-21 UTC only; no historical backfill.';

CREATE OR REPLACE FUNCTION public.trg_award_owen_on_scrim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finalized' AND NEW.finalized_at IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.tracker_session_id IS DISTINCT FROM NEW.tracker_session_id THEN
      PERFORM public.award_owen_badges(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_owen_on_scrim ON public.scrims;

CREATE TRIGGER award_owen_on_scrim
  AFTER INSERT OR UPDATE OF status, tracker_session_id, finalized_at
  ON public.scrims
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_owen_on_scrim();

-- Also re-check when tracker stats land after finalize (same pattern as top frag)
CREATE OR REPLACE FUNCTION public.trg_award_owen_on_player_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scrim_id uuid;
  v_session_id text;
  v_owen_go_forward timestamptz := '2026-08-21T00:00:00+00'::timestamptz;
BEGIN
  v_session_id := coalesce(NEW.session_id, OLD.session_id);

  IF v_session_id IS NULL OR trim(v_session_id) = '' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  FOR v_scrim_id IN
    SELECT s.id
    FROM public.scrims s
    WHERE s.status = 'finalized'
      AND s.finalized_at >= v_owen_go_forward
      AND coalesce(s.is_ranked, false) = true
      AND s.tracker_session_id IS NOT NULL
      AND trim(v_session_id) IN (
        SELECT trim(sid)
        FROM regexp_split_to_table(s.tracker_session_id, '[+~\s]+') AS sid
        WHERE trim(sid) <> ''
      )
  LOOP
    PERFORM public.award_owen_badges(v_scrim_id);
  END LOOP;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS award_owen_on_player_stats ON public.player_stats;

CREATE TRIGGER award_owen_on_player_stats
  AFTER INSERT OR UPDATE OF kills, session_id, name
  ON public.player_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_owen_on_player_stats();

GRANT EXECUTE ON FUNCTION public.award_owen_badges(uuid) TO authenticated, service_role;
