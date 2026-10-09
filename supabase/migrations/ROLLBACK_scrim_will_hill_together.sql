-- ROLLBACK SCRIPT: remove the "Will & Hill" option (20261008_002_scrim_will_hill_together.sql)
--
-- DO NOT RUN THIS WHEN MERGING OR DEPLOYING. It undoes the Will & Hill migration.
-- Only run it if the option has to be removed after release.
--
-- To roll back:
--   1. Roll the app back first (redeploy the previous deployment, or revert
--      the Will & Hill commit and deploy). The old code uses nothing this removes.
--   2. Paste this whole file into the Supabase SQL editor (nothing
--      highlighted) and run it.
--
-- It is one transaction, so a failure changes nothing. Safe to run twice, and
-- safe if the migration was never applied. Scrims created with the option are
-- kept as they are; they just become normal scrims.

BEGIN;

-- If another query is holding the table, fail after 3 seconds instead of
-- making every scrim page wait. Nothing is changed in that case. Run it again.
SET LOCAL lock_timeout = '3s';

DROP FUNCTION IF EXISTS public.check_and_execute_will_hill_team_reroll(UUID);
DROP FUNCTION IF EXISTS public.assign_will_hill_teams(UUID);
DROP FUNCTION IF EXISTS public.split_teams_keeping_pair(UUID, UUID[], BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.will_hill_scrim_player_ids(UUID, BOOLEAN);

-- The migration does not touch scrims_with_counts. If the view was recreated
-- while the column existed, its s.* includes it and the column cannot be
-- dropped until the view is rebuilt. Only in that case it is rebuilt here
-- with the definition from 20260819_001_map_reroll_complete.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scrims_with_counts' AND column_name = 'keep_will_hill_together'
  ) THEN
    DROP VIEW public.scrims_with_counts;
  END IF;
END $$;

ALTER TABLE public.scrims
DROP COLUMN IF EXISTS keep_will_hill_together;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
