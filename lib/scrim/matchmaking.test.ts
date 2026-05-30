import { describe, expect, it } from 'vitest'
import {
  assignEloOptimizedRandomTeams,
  assignKillsBalancedTeams,
  assignRandomTeams,
  assignSkillBasedTeams,
  assignSnakeDraftTeams,
  avgKillsPerScrim,
  countTeams,
  DEFAULT_ELO_OPTIMIZATION_TRIALS,
  eloDifference,
  makeKillsLadder,
  makeLadder,
  makeSkillLadder,
  sumEloByTeam,
  sumRatingByTeam,
  teamForSnakeDraftRank,
  type MatchmakingPlayer,
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

describe('assignEloOptimizedRandomTeams', () => {
  it('assigns even teams for 10 players', () => {
    const teams = assignEloOptimizedRandomTeams(makeLadder(10), {
      random: () => 0.5,
      trials: 10,
    })
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
  })

  it('never does worse than the best of its random trials', () => {
    const players = makeLadder(10, 1000, 50)
    let seed = 0
    const random = () => ((seed += 7) % 100) / 100

    const optimized = assignEloOptimizedRandomTeams(players, { random, trials: 100 })
    const optimizedDiff = eloDifference(sumEloByTeam(players, optimized))

    let bestTrialDiff = Infinity
    seed = 0
    for (let trial = 0; trial < 100; trial++) {
      const trialTeams = assignRandomTeams(
        players.map((p) => ({ id: p.id })),
        { random }
      )
      bestTrialDiff = Math.min(bestTrialDiff, eloDifference(sumEloByTeam(players, trialTeams)))
    }

    expect(optimizedDiff).toBe(bestTrialDiff)
  })

  it('finds zero ELO diff on a symmetric 8-player ladder', () => {
    const players: MatchmakingPlayer[] = [
      { id: 'a1', elo: 1300 },
      { id: 'a2', elo: 1200 },
      { id: 'b1', elo: 1300 },
      { id: 'b2', elo: 1200 },
      { id: 'c1', elo: 1100 },
      { id: 'c2', elo: 1000 },
      { id: 'd1', elo: 1100 },
      { id: 'd2', elo: 1000 },
    ]
    let seed = 0
    const teams = assignEloOptimizedRandomTeams(players, {
      random: () => ((seed += 3) % 100) / 100,
      trials: DEFAULT_ELO_OPTIMIZATION_TRIALS,
    })
    expect(eloDifference(sumEloByTeam(players, teams))).toBe(0)
  })

  it('rejects fewer than 8 players', () => {
    expect(() =>
      assignEloOptimizedRandomTeams(makeLadder(7), { trials: 1 })
    ).toThrow(/at least 8 players/)
  })
})

describe('assignSkillBasedTeams', () => {
  const players = makeSkillLadder(10)

  it('matches assignEloOptimizedRandomTeams (ELO only)', () => {
    let seed = 0
    const random = () => ((seed += 11) % 100) / 100
    const skillTeams = assignSkillBasedTeams(players, { random, trials: 50 })
    seed = 0
    const eloTeams = assignEloOptimizedRandomTeams(
      players.map((p) => ({ id: p.id, elo: p.elo })),
      { random, trials: 50 }
    )
    expect(skillTeams).toEqual(eloTeams)
  })

  it('produces even teams', () => {
    const teams = assignSkillBasedTeams(players, { random: () => 0.3, trials: 20 })
    expect(countTeams(teams)).toEqual({ team_a: 5, team_b: 5 })
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
