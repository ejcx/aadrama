/**
 * Tiered map selection for scrims.
 *
 * Tier totals:
 *   Tier 1: 2/3 (~66.67%)
 *   Tiers 2–6: remaining 1/3, descending slowly via 5:4:3:2:1 weights
 *   (strictly decreasing, gentler than the original spreadsheet cliff).
 *
 * Within each tier, maps keep their relative weights from the spreadsheet.
 */

export type MapTier = 1 | 2 | 3 | 4 | 5 | 6

export interface TieredMapEntry {
  name: string
  tier: MapTier
  /** Relative weight within the tier (from spreadsheet Map %) */
  relativeWeight: number
}

/** Slow descending weights for tiers 2–6 (sum = 15). */
const LOWER_TIER_WEIGHTS = {
  2: 5,
  3: 4,
  4: 3,
  5: 2,
  6: 1,
} as const

const LOWER_WEIGHT_SUM =
  LOWER_TIER_WEIGHTS[2] +
  LOWER_TIER_WEIGHTS[3] +
  LOWER_TIER_WEIGHTS[4] +
  LOWER_TIER_WEIGHTS[5] +
  LOWER_TIER_WEIGHTS[6]

const TIER_1_TOTAL = 2 / 3
const LOWER_REMAINING = 1 - TIER_1_TOTAL

/** Absolute probability mass for each tier (sums to 1, strictly descending). */
export const TIER_TOTALS: Record<MapTier, number> = {
  1: TIER_1_TOTAL,
  2: LOWER_REMAINING * (LOWER_TIER_WEIGHTS[2] / LOWER_WEIGHT_SUM),
  3: LOWER_REMAINING * (LOWER_TIER_WEIGHTS[3] / LOWER_WEIGHT_SUM),
  4: LOWER_REMAINING * (LOWER_TIER_WEIGHTS[4] / LOWER_WEIGHT_SUM),
  5: LOWER_REMAINING * (LOWER_TIER_WEIGHTS[5] / LOWER_WEIGHT_SUM),
  6: LOWER_REMAINING * (LOWER_TIER_WEIGHTS[6] / LOWER_WEIGHT_SUM),
}

/**
 * Maps and within-tier relative weights from the spreadsheet.
 * FLS assault had 0% and is omitted (never selectable).
 */
export const TIERED_MAPS: readonly TieredMapEntry[] = [
  // Tier 1
  { name: 'Insurgent Camp', tier: 1, relativeWeight: 18 },
  { name: 'Pipeline', tier: 1, relativeWeight: 10 },
  { name: 'Weapons Cache', tier: 1, relativeWeight: 9 },
  { name: 'Collapsed Tunnel', tier: 1, relativeWeight: 9 },
  { name: 'Urban Assault', tier: 1, relativeWeight: 14 },
  { name: 'MOUT Mckenna', tier: 1, relativeWeight: 15 },
  // Tier 2
  { name: 'Mountain Ambush', tier: 2, relativeWeight: 2 },
  { name: 'HQ Raid', tier: 2, relativeWeight: 2.5 },
  { name: 'SF Sandstorm', tier: 2, relativeWeight: 3 },
  { name: 'Weapons Cache SE', tier: 2, relativeWeight: 1.5 },
  { name: 'SF CSAR', tier: 2, relativeWeight: 2 },
  { name: 'Mountain Pass SE', tier: 2, relativeWeight: 0.5 },
  { name: 'Dusk', tier: 2, relativeWeight: 2 },
  { name: 'River Basin', tier: 2, relativeWeight: 1 },
  { name: 'Canyon', tier: 2, relativeWeight: 2.5 },
  // Tier 3
  { name: 'JRTC Farm', tier: 3, relativeWeight: 1 },
  { name: 'Woodland Outpost', tier: 3, relativeWeight: 1 },
  { name: 'Border', tier: 3, relativeWeight: 1 },
  { name: 'Radio Tower', tier: 3, relativeWeight: 0.25 },
  { name: 'SF Talga', tier: 3, relativeWeight: 0.25 },
  { name: 'Pipeline SF', tier: 3, relativeWeight: 0.4 },
  { name: 'Bridge SE', tier: 3, relativeWeight: 1.1 },
  { name: 'River Village', tier: 3, relativeWeight: 1.2 },
  // Tier 4
  { name: 'SF Hospital', tier: 4, relativeWeight: 0.05 },
  { name: 'SF Dockside', tier: 4, relativeWeight: 0.05 },
  { name: 'Mountain Pass', tier: 4, relativeWeight: 0.05 },
  { name: 'Swamp Raid', tier: 4, relativeWeight: 0.4 },
  { name: 'SF Village', tier: 4, relativeWeight: 0.2 },
  { name: 'SF Oasis', tier: 4, relativeWeight: 0.2 },
  { name: 'SF Courtyard', tier: 4, relativeWeight: 0.25 },
  // Tier 5
  { name: 'Rummage', tier: 5, relativeWeight: 0.12 },
  { name: 'SF Old Town', tier: 5, relativeWeight: 0.1 },
  { name: 'SF Blizzard', tier: 5, relativeWeight: 0.075 },
  { name: 'SF Recon', tier: 5, relativeWeight: 0.03 },
  { name: 'SF Arctic', tier: 5, relativeWeight: 0.02 },
  { name: 'SF Water Treatment', tier: 5, relativeWeight: 0.035 },
  { name: 'Bridge Crossing', tier: 5, relativeWeight: 0.12 },
  // Tier 6 (FLS assault omitted — 0% in spreadsheet)
  { name: 'District', tier: 6, relativeWeight: 0.071 },
  { name: 'SF PCR', tier: 6, relativeWeight: 0.01 },
  { name: 'SF Floodgate', tier: 6, relativeWeight: 0.01 },
  { name: 'SF Refinery', tier: 6, relativeWeight: 0.005 },
  { name: 'Steamroller', tier: 6, relativeWeight: 0.002 },
  { name: 'SF Extraction', tier: 6, relativeWeight: 0.002 },
] as const

/** Absolute selection weight for a map (tier total × within-tier share). */
export function absoluteWeight(entry: TieredMapEntry): number {
  const tierMaps = TIERED_MAPS.filter(m => m.tier === entry.tier)
  const relativeSum = tierMaps.reduce((sum, m) => sum + m.relativeWeight, 0)
  if (relativeSum <= 0) return 0
  return TIER_TOTALS[entry.tier] * (entry.relativeWeight / relativeSum)
}

/** Cumulative weight table for weighted random pick. */
export function buildWeightedPool(
  maps: readonly TieredMapEntry[] = TIERED_MAPS
): { name: string; weight: number; cumulative: number }[] {
  let cumulative = 0
  return maps
    .map(entry => {
      const weight = absoluteWeight(entry)
      cumulative += weight
      return { name: entry.name, weight, cumulative }
    })
    .filter(m => m.weight > 0)
}

/**
 * Pick a map using tiered weights.
 * @param random - value in [0, 1); defaults to Math.random()
 */
export function pickTieredMap(random: () => number = Math.random): string {
  const pool = buildWeightedPool()
  if (pool.length === 0) {
    throw new Error('Tiered map pool is empty')
  }

  const total = pool[pool.length - 1].cumulative
  const roll = random() * total

  for (const entry of pool) {
    if (roll < entry.cumulative) {
      return entry.name
    }
  }

  return pool[pool.length - 1].name
}
