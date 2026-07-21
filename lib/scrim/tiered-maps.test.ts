import { describe, expect, it } from 'vitest'
import {
  absoluteWeight,
  buildWeightedPool,
  pickTieredMap,
  TIER_TOTALS,
  TIERED_MAPS,
  type MapTier,
} from './tiered-maps'

describe('TIER_TOTALS', () => {
  it('sums to 1', () => {
    const sum = ([1, 2, 3, 4, 5, 6] as MapTier[]).reduce(
      (s, t) => s + TIER_TOTALS[t],
      0
    )
    expect(sum).toBeCloseTo(1, 10)
  })

  it('uses 2/3 for tier 1', () => {
    expect(TIER_TOTALS[1]).toBeCloseTo(2 / 3, 10)
  })

  it('uses slow 5:4:3:2:1 descent for tiers 2–6', () => {
    const lower = 1 - 2 / 3
    const weightSum = 5 + 4 + 3 + 2 + 1
    expect(TIER_TOTALS[2]).toBeCloseTo(lower * (5 / weightSum), 10)
    expect(TIER_TOTALS[3]).toBeCloseTo(lower * (4 / weightSum), 10)
    expect(TIER_TOTALS[4]).toBeCloseTo(lower * (3 / weightSum), 10)
    expect(TIER_TOTALS[5]).toBeCloseTo(lower * (2 / weightSum), 10)
    expect(TIER_TOTALS[6]).toBeCloseTo(lower * (1 / weightSum), 10)
  })

  it('descends strictly by tier', () => {
    expect(TIER_TOTALS[1]).toBeGreaterThan(TIER_TOTALS[2])
    expect(TIER_TOTALS[2]).toBeGreaterThan(TIER_TOTALS[3])
    expect(TIER_TOTALS[3]).toBeGreaterThan(TIER_TOTALS[4])
    expect(TIER_TOTALS[4]).toBeGreaterThan(TIER_TOTALS[5])
    expect(TIER_TOTALS[5]).toBeGreaterThan(TIER_TOTALS[6])
  })
})

describe('absoluteWeight', () => {
  it('sums to each tier total within the tier', () => {
    for (const tier of [1, 2, 3, 4, 5, 6] as MapTier[]) {
      const sum = TIERED_MAPS.filter(m => m.tier === tier).reduce(
        (s, m) => s + absoluteWeight(m),
        0
      )
      expect(sum).toBeCloseTo(TIER_TOTALS[tier], 10)
    }
  })

  it('sums to 1 across the full pool', () => {
    const sum = TIERED_MAPS.reduce((s, m) => s + absoluteWeight(m), 0)
    expect(sum).toBeCloseTo(1, 10)
  })
})

describe('pickTieredMap', () => {
  it('returns a known map name', () => {
    const name = pickTieredMap(() => 0)
    expect(TIERED_MAPS.some(m => m.name === name)).toBe(true)
  })

  it('picks the last map when roll is just under 1', () => {
    const pool = buildWeightedPool()
    const name = pickTieredMap(() => 0.999999999)
    expect(name).toBe(pool[pool.length - 1].name)
  })

  it('respects weighted order for a mid-pool roll', () => {
    const pool = buildWeightedPool()
    // Roll into the middle of the first map's band
    const first = pool[0]
    const name = pickTieredMap(() => (first.weight / 2) / pool[pool.length - 1].cumulative)
    expect(name).toBe(first.name)
  })

  it('roughly matches tier 1 mass over many trials', () => {
    const tier1Names = new Set(TIERED_MAPS.filter(m => m.tier === 1).map(m => m.name))
    let hits = 0
    const trials = 20_000
    for (let i = 0; i < trials; i++) {
      if (tier1Names.has(pickTieredMap())) hits++
    }
    const rate = hits / trials
    expect(rate).toBeGreaterThan(0.64)
    expect(rate).toBeLessThan(0.70)
  })
})
