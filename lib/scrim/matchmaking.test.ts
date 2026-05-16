import { describe, expect, it } from 'vitest'
import {
  assignKillsBalancedTeams,
  assignRandomTeams,
  assignSkillBasedTeams,
  assignSnakeDraftTeams,
  avgKillsPerScrim,
  countTeams,
  makeKillsLadder,
  makeLadder,
  makeSkillLadder,
  pickSkillMetric,
  sumEloByTeam,
  sumRatingByTeam,
  teamForSnakeDraftRank,
  type MatchmakingPlayer,
  type SkillBasedPlayer,
} from './matchmaking'

describe('teamForSnakeDraftRank', () => {
  it.each([
    [1, 'team_a'],
    [2, 'team_b'],
    [3, 'team_b'],
    [4, 'team_a'],
    [5, 'team_a'],
    [6, 'team_b'],
    [7, 'team_b'],
    [8, 'team_a'],
    [9, 'team_a'],
    [10, 'team_b'],
  ] as const)('rank %i → %s', (rank, team) => {
    expect(teamForSnakeDraftRank(rank)).toBe(team)
  })

  it('rejects invalid ranks', () => {
    expect(() => teamForSnakeDraftRank(0)).toThrow(/Invalid snake-draft rank/)
    expect(() => teamForSnakeDraftRank(1.5)).toThrow(/Invalid snake-draft rank/)
  })
})

describe('avgKillsPerScrim', () => {
  it('returns average when scrims exist', () => {
    expect(avgKillsPerScrim(45, 9)).toBe(5)
  })

  it('returns 0 when no scrims', () => {
    expect(avgKillsPerScrim(0, 0)).toBe(0)
    expect(avgKillsPerScrim(10, 0)).toBe(0)
  })
})

describe('pickSkillMetric', () => {
  it('picks elo when random < 0.5', () => {
    expect(pickSkillMetric(() => 0)).toBe('elo')
    expect(pickSkillMetric(() => 0.49)).toBe('elo')
  })

  it('picks kills when random >= 0.5', () => {
    expect(pickSkillMetric(() => 0.5)).toBe('kills')
    expect(pickSkillMetric(() => 0.99)).toBe('kills')
  })
})

describe('assignSnakeDraftTeams', () => {
  it('assigns 5v5 for 10 players', () => {
    const players = makeLadder(10)
    const teams = assignSnakeDraftTeams(players)
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
    expect(teams.size).toBe(10)
  })

  it.each([8, 12, 16])('assigns even teams for %i players', (n) => {
    const teams = assignSnakeDraftTeams(makeLadder(n))
    expect(countTeams(teams)).toEqual({ team_a: n / 2, team_b: n / 2 })
  })

  it('rejects fewer than 8 players', () => {
    expect(() => assignSnakeDraftTeams(makeLadder(7))).toThrow(/at least 8 players/)
  })

  it('rejects odd player counts', () => {
    expect(() => assignSnakeDraftTeams(makeLadder(9))).toThrow(/even number of players/)
  })

  it('never produces 6v4 (regression: punitive hill/will stacking)', () => {
    const teams = assignSnakeDraftTeams(makeLadder(10))
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
  })
})

describe('assignKillsBalancedTeams', () => {
  it('assigns 5v5 for 10 players by avg kills', () => {
    const teams = assignKillsBalancedTeams(makeKillsLadder(10))
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
  })

  it('balances total avg-kills rating for 8 players on a linear ladder', () => {
    const players = makeKillsLadder(8, 4, 2)
    const teams = assignKillsBalancedTeams(players)
    const sums = sumRatingByTeam(
      players.map((p) => ({ id: p.id, rating: p.avgKillsPerScrim })),
      teams
    )
    expect(sums.team_a).toBe(sums.team_b)
  })

  it('puts highest and lowest killers on opposite teams (10-player snake)', () => {
    const players = makeKillsLadder(10, 3, 2)
    const byKills = [...players].sort((a, b) => b.avgKillsPerScrim - a.avgKillsPerScrim)
    const teams = assignKillsBalancedTeams(players)
    expect(teams.get(byKills[0]!.id)).toBe('team_a')
    expect(teams.get(byKills[9]!.id)).toBe('team_b')
  })
})

describe('assignSkillBasedTeams', () => {
  const players = makeSkillLadder(10)

  it('uses ELO snake draft when random < 0.5', () => {
    const { metric, assignments } = assignSkillBasedTeams(players, { random: () => 0 })
    expect(metric).toBe('elo')
    expect(assignments).toEqual(assignSnakeDraftTeams(players.map((p) => ({ id: p.id, elo: p.elo }))))
  })

  it('uses kills snake draft when random >= 0.5', () => {
    const { metric, assignments } = assignSkillBasedTeams(players, { random: () => 0.5 })
    expect(metric).toBe('kills')
    expect(assignments).toEqual(
      assignKillsBalancedTeams(
        players.map((p) => ({ id: p.id, avgKillsPerScrim: p.avgKillsPerScrim }))
      )
    )
  })

  it('always produces even teams for either metric', () => {
    const eloResult = assignSkillBasedTeams(players, { random: () => 0 })
    const killsResult = assignSkillBasedTeams(players, { random: () => 0.5 })
    expect(countTeams(eloResult.assignments)).toEqual({ team_a: 5, team_b: 5 })
    expect(countTeams(killsResult.assignments)).toEqual({ team_a: 5, team_b: 5 })
  })

})

describe('assignRandomTeams', () => {
  it('splits 10 players evenly', () => {
    let seed = 0
    const teams = assignRandomTeams(
      makeLadder(10).map((p) => ({ id: p.id })),
      { random: () => ((seed += 1) % 100) / 100 }
    )
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
  })
})

describe('legacy elo helpers', () => {
  it('sumEloByTeam matches sumRatingByTeam for elo players', () => {
    const players = makeLadder(8, 1000, 100)
    const teams = assignSnakeDraftTeams(players)
    expect(sumEloByTeam(players, teams)).toEqual(
      sumRatingByTeam(
        players.map((p) => ({ id: p.id, rating: p.elo })),
        teams
      )
    )
  })

  it('balances ELO exactly for 8 players on a linear ladder', () => {
    const players = makeLadder(8, 1000, 100)
    const teams = assignSnakeDraftTeams(players)
    expect(sumEloByTeam(players, teams).team_a).toBe(sumEloByTeam(players, teams).team_b)
  })

  it('puts highest and lowest rated on opposite teams (10-player snake)', () => {
    const players: MatchmakingPlayer[] = [
      { id: 'top', elo: 2000 },
      { id: 'p2', elo: 1700 },
      { id: 'p3', elo: 1600 },
      { id: 'p4', elo: 1500 },
      { id: 'p5', elo: 1400 },
      { id: 'p6', elo: 1300 },
      { id: 'p7', elo: 1200 },
      { id: 'p8', elo: 1100 },
      { id: 'p9', elo: 1000 },
      { id: 'bottom', elo: 800 },
    ]
    const teams = assignSnakeDraftTeams(players)
    expect(teams.get('top')).toBe('team_a')
    expect(teams.get('bottom')).toBe('team_b')
  })
})
