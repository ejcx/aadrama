import { describe, expect, it } from 'vitest'
import {
  buildComparisonLabel,
  computeTeammateStats,
  type RankedGame,
} from './teammate-stats'

describe('computeTeammateStats', () => {
  const games: RankedGame[] = [
    { gameNameLower: 'joe131', scrimId: 's1', result: 'win', roundsFor: 10, roundsAgainst: 5, kills: 20, map: 'de_dust2' },
    { gameNameLower: 'di.mediocre', scrimId: 's1', result: 'win', roundsFor: 10, roundsAgainst: 5, kills: 15, map: 'de_dust2' },
    { gameNameLower: 'joe131', scrimId: 's2', result: 'loss', roundsFor: 4, roundsAgainst: 10, kills: 8, map: 'de_mirage' },
    { gameNameLower: 're1ativity2', scrimId: 's2', result: 'win', roundsFor: 10, roundsAgainst: 4, kills: 12, map: 'de_mirage' },
    { gameNameLower: 'joe131', scrimId: 's3', result: 'win', roundsFor: 8, roundsAgainst: 6, kills: 18, map: 'de_dust2' },
    { gameNameLower: 're1ativity2', scrimId: 's3', result: 'win', roundsFor: 8, roundsAgainst: 6, kills: 22, map: 'de_dust2' },
    { gameNameLower: 'effingee', scrimId: 's3', result: 'win', roundsFor: 8, roundsAgainst: 6, kills: 10, map: 'de_dust2' },
    { gameNameLower: 'joe131', scrimId: 's4', result: 'win', roundsFor: 7, roundsAgainst: 5, kills: 14, map: 'de_inferno' },
    { gameNameLower: 're1ativity2', scrimId: 's4', result: 'win', roundsFor: 7, roundsAgainst: 5, kills: 16, map: 'de_inferno' },
  ]

  const names = new Map([
    ['joe131', 'joe131'],
    ['di.mediocre', 'di.mediocre'],
    ['re1ativity2', 're1ativity2'],
    ['effingee', 'effingee'],
  ])

  it('counts with-teammate games', () => {
    const [stat] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'with' }]
    )
    expect(stat.games).toBe(1)
    expect(stat.wins).toBe(1)
  })

  it('counts against-teammate games', () => {
    const [stat] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 're1ativity2', mode: 'against' }]
    )
    expect(stat.games).toBe(1)
    expect(stat.losses).toBe(1)
  })

  it('counts everyone-but games', () => {
    const [withEff] = computeTeammateStats(
      games,
      names,
      [{ subject: 're1ativity2', teammate: 'effingee', mode: 'with' }]
    )
    expect(withEff.games).toBe(1)

    const [everyoneButEff] = computeTeammateStats(
      games,
      names,
      [{ subject: 're1ativity2', teammate: 'effingee', mode: 'everyone_but' }]
    )
    expect(everyoneButEff.games).toBe(1)
    expect(everyoneButEff.wins).toBe(1)
    expect(everyoneButEff.label).toContain('everyone but effingee')

    const [everyoneButDi] = computeTeammateStats(
      games,
      names,
      [{ subject: 'joe131', teammate: 'di.mediocre', mode: 'everyone_but' }]
    )
    expect(everyoneButDi.games).toBe(2)
  })

  it('counts all-teammates games', () => {
    const [stat] = computeTeammateStats(
      games,
      names,
      [{ subject: 're1ativity2', teammate: '', mode: 'all_teammates' }]
    )
    expect(stat.games).toBe(2)
    expect(stat.wins).toBe(2)
  })

  it('builds labels for new modes', () => {
    expect(buildComparisonLabel('re1', 'effingee', 'everyone_but')).toBe(
      're1 with everyone but effingee'
    )
    expect(buildComparisonLabel('re1', 'others', 'all_teammates')).toBe(
      're1 with any ranked teammate'
    )
    expect(buildComparisonLabel('re1', 'effingee', 'against')).toBe(
      're1 against effingee'
    )
  })
})
