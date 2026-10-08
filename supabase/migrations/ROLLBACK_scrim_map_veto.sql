-- ROLLBACK SCRIPT: remove the veto map choice (20261008_001_scrim_map_veto.sql)
--
-- DO NOT RUN THIS WHEN MERGING OR DEPLOYING. It undoes the veto migration.
-- Only run it if veto has to be removed after release.
--
-- To roll back:
--   1. Roll the app back first (redeploy the previous deployment, or revert
--      the veto commit and deploy). The old code uses nothing this removes.
--   2. Paste this whole file into the Supabase SQL editor (nothing
--      highlighted) and run it.
--
-- It is one transaction, so a failure changes nothing. Safe to run twice, and
-- safe if the veto migration was never applied. To bring veto back later, run
-- 20261008_001_scrim_map_veto.sql again and redeploy the veto code.
--
-- Existing veto scrims are kept, not deleted:
--   - Map already decided (in progress, scoring, finalized, or decided in the
--     lobby): becomes a 'manual' scrim with the same map, scores and ELO.
--   - Still voting in the lobby: becomes a 'tiered' scrim, so it gets a random
--     tiered map when it starts.
--   - In progress and re-voting after a map reroll (no map at that moment):
--     becomes 'tiered' and gets a random tiered map right away.
--   The votes and the 4 offered maps go away with the veto columns.

BEGIN;

-- If another query is holding these tables, fail after 3 seconds instead of
-- making every scrim page wait. Nothing is changed in that case. Run it again.
SET LOCAL lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1) Convert existing veto scrims so the old check and the old code accept them
-- ---------------------------------------------------------------------------
-- These updates leave status, tracker_session_id and finalized_at alone, so no
-- trigger fires: no badges, no stats refresh, no ELO changes.
UPDATE public.scrims
SET map_choice = 'manual'
WHERE map_choice = 'veto' AND map IS NOT NULL;

UPDATE public.scrims
SET map_choice = 'tiered'
WHERE map_choice = 'veto';

-- Games already under way that have no map right now (mid re-vote)
DO $$
DECLARE
  v_id UUID;
BEGIN
  IF to_regprocedure('public.assign_tiered_map_if_needed(uuid)') IS NOT NULL THEN
    FOR v_id IN
      SELECT id FROM public.scrims
      WHERE map_choice = 'tiered' AND map IS NULL AND status IN ('in_progress', 'scoring')
    LOOP
      PERFORM public.assign_tiered_map_if_needed(v_id);
    END LOOP;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Functions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.check_and_execute_veto_team_reroll(UUID);
DROP FUNCTION IF EXISTS public.check_and_execute_veto_map_reroll(UUID);
DROP FUNCTION IF EXISTS public.cast_map_veto_vote(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sync_map_veto(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.pick_veto_map_options(INTEGER, TEXT[]);

-- ---------------------------------------------------------------------------
-- 3) Columns
-- ---------------------------------------------------------------------------
-- The veto migration does not touch scrims_with_counts. If the view was
-- recreated while the veto columns existed, its s.* includes them and they
-- cannot be dropped until the view is rebuilt. Only in that case it is
-- rebuilt here with the definition from 20260819_001_map_reroll_complete.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scrims_with_counts' AND column_name LIKE 'veto\_%'
  ) THEN
    DROP VIEW public.scrims_with_counts;
  END IF;
END $$;

ALTER TABLE public.scrim_players
DROP COLUMN IF EXISTS veto_map_vote;

ALTER TABLE public.scrims
DROP COLUMN IF EXISTS veto_maps,
DROP COLUMN IF EXISTS veto_ends_at,
DROP COLUMN IF EXISTS veto_resolved_at,
DROP COLUMN IF EXISTS veto_tiebreak;

DO $$
BEGIN
  IF to_regclass('public.scrims_with_counts') IS NULL THEN
    CREATE VIEW public.scrims_with_counts AS
    SELECT
      s.*,
      COALESCE(pc.player_count, 0) AS player_count,
      COALESCE(pc.ready_count, 0) AS ready_count,
      COALESCE(pc.reroll_votes, 0) AS reroll_votes,
      COALESCE(sc.score_submission_count, 0) AS score_submission_count
    FROM public.scrims s
    LEFT JOIN (
      SELECT
        scrim_id,
        COUNT(*) AS player_count,
        COUNT(*) FILTER (WHERE is_ready) AS ready_count,
        COUNT(*) FILTER (WHERE voted_reroll) AS reroll_votes
      FROM public.scrim_players
      GROUP BY scrim_id
    ) pc ON s.id = pc.scrim_id
    LEFT JOIN (
      SELECT scrim_id, COUNT(*) AS score_submission_count
      FROM public.scrim_score_submissions
      GROUP BY scrim_id
    ) sc ON s.id = sc.scrim_id;

    GRANT SELECT ON public.scrims_with_counts TO anon, authenticated;

    COMMENT ON VIEW public.scrims_with_counts IS
      'Scrims with player/ready/reroll counts. Recreate after adding columns to public.scrims.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) map_choice check back to its previous definition
-- ---------------------------------------------------------------------------
ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_map_choice_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_map_choice_check
CHECK (map_choice IN ('manual', 'tiered'));

COMMENT ON COLUMN public.scrims.map_choice IS
  'manual = creator picked a specific map; tiered = weighted random map assigned when teams are set';

-- Reload the API schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ---------------------------------------------------------------------------
-- Check afterwards (read-only). Expect 0, 0, and a check that lists only
-- 'manual' and 'tiered'.
-- ---------------------------------------------------------------------------
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname LIKE '%veto%';
-- SELECT count(*) FROM information_schema.columns
--   WHERE table_schema = 'public' AND column_name LIKE 'veto%';
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'scrims_map_choice_check';
