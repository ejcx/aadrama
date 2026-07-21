-- Add map_choice for scrims: 'manual' (default) or 'tiered' (weighted random after teams).
-- scrims_with_counts uses s.*, so the new column is included automatically.

ALTER TABLE public.scrims
ADD COLUMN IF NOT EXISTS map_choice TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.scrims
DROP CONSTRAINT IF EXISTS scrims_map_choice_check;

ALTER TABLE public.scrims
ADD CONSTRAINT scrims_map_choice_check
CHECK (map_choice IN ('manual', 'tiered'));

COMMENT ON COLUMN public.scrims.map_choice IS
  'manual = creator picked a specific map; tiered = weighted random map assigned when teams are set';
