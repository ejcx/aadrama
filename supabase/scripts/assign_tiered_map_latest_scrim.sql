-- One-shot: assign a tiered map to the most recent tiered scrim that is missing one.
-- Run in Supabase SQL editor AFTER applying 20260721_001_assign_tiered_map_proc.sql

SELECT
  id,
  status,
  map_choice,
  map AS map_before,
  public.assign_tiered_map_if_needed(id) AS map_after,
  created_at
FROM public.scrims
WHERE map_choice = 'tiered'
  AND map IS NULL
ORDER BY created_at DESC
LIMIT 1;
