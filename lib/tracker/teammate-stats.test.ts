import { describe, expect, it } from 'vitest'
import { computeTeammateStats, type RankedGame } from './teammate-stats'

describe('computeTeammateStats', () => {
  const games: RankedGame[] = [
    { gameNameLower: 'joe131', scrimId: 's1', result: 'win', roundsFor: 10, roundsAgainst: 5, kills: 20, map: 'de_dust2' },
    { gameNameLower: 'di.mediocre', scrimId: 's1', result: 'win', roundsFor: 10, roundsAgainst: 5, kills: 15, map: 'de_dust2' },
    { gameNameLower: 'joe131', scrimId: 's2', result: 'loss', roundsFor: 4, roundsAgainst: 10, kills: 8, map: 'de_mirage' },
    { gameNameLower: 're1ativity2', scrimId: 's2', result: 'loss', roundsFor: 4, roundsAgainst: 10, kills: 12, map: 'de_mirage' },
    { gameNameLower: 'joe131', scrimId: 's3', result: 'win', roundsFor: 8, roundsAgainst: 6, kills: 18, map: 'de_dust2' },
    { gameNameLower: 're1ativity2', scrimId: 's3', result: 'win', roundsFor: 8, roundsAgainst: 6, kills: 22, map: 'de_dust2' },
  ]

  const names = new Map([
    ['joe131', 'joe131'],
    ['di.mediocre', 'di.mediocre'],
    ['re1ativity2', 're1ativity2'],
  ])

  it('counts with-teammate games', () => {
    const [stat] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'with' }]
    )
    expect(stat.wins).toBe(1)
    expect(stat.losses).toBe(0)
    expect(stat.games).toBe(1)
    expect(stat.winPct).toBe(100)
    expect(stat.roundsWon).toBe(10)
    expect(stat.roundsLost).toBe(5)
    expect(stat.roundWinPct).toBe(66.7)
    expect(stat.totalKills).toBe(20)
    expect(stat.fragRate).toBe(20)
  })

  it('filters by map when set on comparison', () => {
    const [dust2] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'with', map: 'de_dust2' }]
    )
    expect(dust2.games).toBe(1)
    const [allMaps] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'with' }]
    )
    expect(allMaps.games).toBe(1)
  })

  it('counts without-teammate games', () => {
    const [stat] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'without' }]
    )
    expect(stat.wins).toBe(1)
    expect(stat.losses).toBe(1)
    expect(stat.games).toBe(2)
    expect(stat.winPct).toBe(50)
  })
})
