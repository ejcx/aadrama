import { describe, expect, it } from 'vitest'
import {
  calculateExpectedScore,
  calculateKothKFactor,
  calculateTeamEloChange,
} from './elo'
import { buildRosterKey } from './roster'

describe('koth elo', () => {
  it('uses high K for new teams', () => {
    expect(calculateKothKFactor(0)).toBe(40)
    expect(calculateKothKFactor(10)).toBe(32)
    expect(calculateKothKFactor(50)).toBe(16)
  })

  it('gives equal teams ~0 change on draw', () => {
    const { change } = calculateTeamEloChange({
      teamElo: 1200,
      opponentElo: 1200,
      result: 'draw',
      teamScore: 5,
      opponentScore: 5,
      gamesPlayed: 20,
    })
    expect(change).toBe(0)
  })

  it('awards positive change for underdog win', () => {
    const { change } = calculateTeamEloChange({
      teamElo: 1100,
      opponentElo: 1300,
      result: 'win',
      teamScore: 7,
      opponentScore: 3,
      gamesPlayed: 20,
    })
    expect(change).toBeGreaterThan(0)
  })

  it('expected score is 0.5 for equal ratings', () => {
    expect(calculateExpectedScore(1200, 1200)).toBeCloseTo(0.5)
  })
})

describe('roster key', () => {
  it('sorts user ids for stable identity', () => {
    expect(buildRosterKey(['b', 'a', 'c'])).toBe('a|b|c')
    expect(buildRosterKey(['a', 'b'])).toBe(buildRosterKey(['b', 'a']))
  })
})
