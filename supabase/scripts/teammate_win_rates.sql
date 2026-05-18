-- Teammate win rates from ranked games (elo_history).
-- Teammates = same scrim_id + same result (win/loss/draw) — same as team outcome in ranked processing.
-- Win% = wins / (wins + losses). Run in Supabase SQL Editor.

WITH ranked_games AS (
  SELECT
    eh.game_name_lower,
    eh.scrim_id,
    eh.result
  FROM public.elo_history eh
  INNER JOIN public.scrims s ON s.id = eh.scrim_id
  WHERE s.status = 'finalized'
),

stats AS (
  SELECT
    subject.game_name_lower AS player,
    bucket,
    count(*) FILTER (WHERE subject.result = 'win') AS wins,
    count(*) FILTER (WHERE subject.result = 'loss') AS losses,
    count(*) FILTER (WHERE subject.result = 'draw') AS draws
  FROM (
    SELECT p.game_name_lower, p.scrim_id, p.result, 'joe131 with di.mediocre' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 'joe131'
      AND EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'di.mediocre'
          AND t.result = p.result
      )

    UNION ALL

    SELECT p.game_name_lower, p.scrim_id, p.result, 'joe131 without di.mediocre on team' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 'joe131'
      AND NOT EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'di.mediocre'
          AND t.result = p.result
      )

    UNION ALL

    SELECT p.game_name_lower, p.scrim_id, p.result, 're1ativity2 with joe131' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 're1ativity2'
      AND EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'joe131'
          AND t.result = p.result
      )

    UNION ALL

    SELECT p.game_name_lower, p.scrim_id, p.result, 'di.mediocre with joe131' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 'di.mediocre'
      AND EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'joe131'
          AND t.result = p.result
      )

    UNION ALL

    SELECT p.game_name_lower, p.scrim_id, p.result, 'di.mediocre without joe131 on team' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 'di.mediocre'
      AND NOT EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'joe131'
          AND t.result = p.result
      )

    UNION ALL

    SELECT p.game_name_lower, p.scrim_id, p.result, 're1ativity2 with di.mediocre' AS bucket
    FROM ranked_games p
    WHERE p.game_name_lower = 're1ativity2'
      AND EXISTS (
        SELECT 1 FROM ranked_games t
        WHERE t.scrim_id = p.scrim_id
          AND t.game_name_lower = 'di.mediocre'
          AND t.result = p.result
      )
  ) subject
  GROUP BY subject.game_name_lower, bucket
)

SELECT
  bucket,
  player,
  wins,
  losses,
  draws,
  wins + losses + draws AS games,
  round(100.0 * wins / nullif(wins + losses, 0), 1) AS win_pct
FROM stats
ORDER BY bucket;
