-- Prevent duplicate ELO processing for the same scrim: one elo_history row per (scrim_id, game_name_lower)
-- Fixes race where finalize + ELO processing could run twice and insert duplicate rows

-- 1. Remove duplicate rows, keeping the earliest row per (scrim_id, game_name_lower)
DELETE FROM public.elo_history eh
USING (
  SELECT id,
    row_number() OVER (PARTITION BY scrim_id, game_name_lower ORDER BY created_at ASC) as rn
  FROM public.elo_history
) ranked
WHERE eh.id = ranked.id
  AND ranked.rn > 1;

-- 2. Add uniqueness so a scrim cannot have two ELO history entries for the same player
ALTER TABLE public.elo_history
  ADD CONSTRAINT elo_history_scrim_player_unique UNIQUE (scrim_id, game_name_lower);

COMMENT ON CONSTRAINT elo_history_scrim_player_unique ON public.elo_history IS
  'Prevents duplicate ELO processing for the same scrim+player (race condition guard)';
