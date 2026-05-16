/**
 * Scrim team matchmaking (snake draft by skill metric + random reroll).
 *
 * Keep in sync with Supabase functions:
 * - assign_elo_balanced_teams / assign_kills_balanced_teams / assign_skill_based_teams
 * - assign_balanced_teams / assign_purely_random_teams
 *
 * Run: npm test -- lib/scrim/matchmaking.test.ts
 */

export type Team = 'team_a' | 'team_b'

export type SkillMetric = 'elo' | 'kills'

export interface RatedPlayer {
  id: string
  rating: number
}

export interface MatchmakingPlayer {
  id: string
  elo: number
}

export interface KillsMatchmakingPlayer {
  id: string
  avgKillsPerScrim: number
}

export interface SkillBasedPlayer {
  id: string
  elo: number
  avgKillsPerScrim: number
}

export const DEFAULT_MIN_PLAYERS = 8

export const DEFAULT_ELO = 1200

/** Average kills per finalized scrim (0 when no scrim history). */
export function avgKillsPerScrim(totalKills: number, totalScrims: number): number {
  if (totalScrims <= 0) return 0
  return totalKills / totalScrims
}

/** 50/50 pick for skill-based matchmaking. Matches assign_skill_based_teams (random() < 0.5). */
export function pickSkillMetric(random: () => number = Math.random): SkillMetric {
  return random() < 0.5 ? 'elo' : 'kills'
}

/** 1-based rank → team. Matches SQL in assign_*_balanced_teams migrations. */
export function teamForSnakeDraftRank(rank: number): Team {
  if (rank < 1 || !Number.isInteger(rank)) {
    throw new Error(`Invalid snake-draft rank: ${rank}`)
  }
  const pairIndex = Math.floor((rank - 1) / 2)
  const forwardPair = pairIndex % 2 === 0
  const firstInPair = (rank - 1) % 2 === 0
  if (forwardPair) {
    return firstInPair ? 'team_a' : 'team_b'
  }
  return firstInPair ? 'team_b' : 'team_a'
}

export type CompareRatedPlayers = (a: RatedPlayer, b: RatedPlayer) => number

function defaultCompareRated(a: RatedPlayer, b: RatedPlayer): number {
  if (b.rating !== a.rating) return b.rating - a.rating
  return a.id.localeCompare(b.id)
}

export interface AssignSnakeDraftOptions {
  minPlayers?: number
  comparePlayers?: CompareRatedPlayers
}

function toRated(players: Array<{ id: string; rating: number }>): RatedPlayer[] {
  return players.map((p) => ({ id: p.id, rating: p.rating }))
}

/**
 * Snake draft: sort by rating desc, assign teams by rank pattern.
 */
export function assignSnakeDraftByRating(
  players: RatedPlayer[],
  options: AssignSnakeDraftOptions = {}
): Map<string, Team> {
  const minPlayers = options.minPlayers ?? DEFAULT_MIN_PLAYERS
  const compare = options.comparePlayers ?? defaultCompareRated

  if (players.length < minPlayers) {
    throw new Error(
      `Cannot assign teams: need at least ${minPlayers} players (4v4), got ${players.length}`
    )
  }
  if (players.length % 2 !== 0) {
    throw new Error(
      `Cannot assign teams: must have even number of players (got ${players.length})`
    )
  }

  const sorted = [...players].sort(compare)
  const assignments = new Map<string, Team>()

  sorted.forEach((player, index) => {
    assignments.set(player.id, teamForSnakeDraftRank(index + 1))
  })

  assertEvenTeams(assignments)
  return assignments
}

export function assignSnakeDraftTeams(
  players: MatchmakingPlayer[],
  options: AssignSnakeDraftOptions = {}
): Map<string, Team> {
  return assignSnakeDraftByRating(
    players.map((p) => ({ id: p.id, rating: p.elo })),
    options
  )
}

export function assignKillsBalancedTeams(
  players: KillsMatchmakingPlayer[],
  options: AssignSnakeDraftOptions = {}
): Map<string, Team> {
  return assignSnakeDraftByRating(
    players.map((p) => ({ id: p.id, rating: p.avgKillsPerScrim })),
    options
  )
}

export interface AssignSkillBasedOptions extends AssignSnakeDraftOptions {
  random?: () => number
}

export interface SkillBasedAssignment {
  metric: SkillMetric
  assignments: Map<string, Team>
}

/** Skill-based: 50/50 snake draft by ELO or by avg kills per scrim. */
export function assignSkillBasedTeams(
  players: SkillBasedPlayer[],
  options: AssignSkillBasedOptions = {}
): SkillBasedAssignment {
  const metric = pickSkillMetric(options.random)
  const assignments =
    metric === 'elo'
      ? assignSnakeDraftTeams(
          players.map((p) => ({ id: p.id, elo: p.elo })),
          options
        )
      : assignKillsBalancedTeams(
          players.map((p) => ({ id: p.id, avgKillsPerScrim: p.avgKillsPerScrim })),
          options
        )
  return { metric, assignments }
}

export interface AssignRandomTeamsOptions {
  minPlayers?: number
  random?: () => number
}

export function assignRandomTeams(
  players: Pick<RatedPlayer, 'id'>[],
  options: AssignRandomTeamsOptions = {}
): Map<string, Team> {
  const minPlayers = options.minPlayers ?? 2
  const random = options.random ?? Math.random

  if (players.length < minPlayers) {
    throw new Error(`Cannot assign teams: need at least ${minPlayers} players, got ${players.length}`)
  }
  if (players.length % 2 !== 0) {
    throw new Error(
      `Cannot assign teams: must have even number of players (got ${players.length})`
    )
  }

  const half = players.length / 2
  const shuffled = [...players].sort(() => random() - 0.5)
  const assignments = new Map<string, Team>()

  shuffled.forEach((player, index) => {
    assignments.set(player.id, index < half ? 'team_a' : 'team_b')
  })

  assertEvenTeams(assignments)
  return assignments
}

export function countTeams(assignments: Map<string, Team>): { team_a: number; team_b: number } {
  let team_a = 0
  let team_b = 0
  assignments.forEach((team) => {
    if (team === 'team_a') team_a++
    else team_b++
  })
  return { team_a, team_b }
}

export function sumRatingByTeam(
  players: RatedPlayer[],
  assignments: Map<string, Team>
): { team_a: number; team_b: number } {
  const byId = new Map(players.map((p) => [p.id, p.rating]))
  let team_a = 0
  let team_b = 0
  assignments.forEach((team, id) => {
    const rating = byId.get(id) ?? 0
    if (team === 'team_a') team_a += rating
    else team_b += rating
  })
  return { team_a, team_b }
}

/** @deprecated Use sumRatingByTeam */
export function sumEloByTeam(
  players: MatchmakingPlayer[],
  assignments: Map<string, Team>
): { team_a: number; team_b: number } {
  return sumRatingByTeam(
    players.map((p) => ({ id: p.id, rating: p.elo })),
    assignments
  )
}

function assertEvenTeams(assignments: Map<string, Team>): void {
  const { team_a, team_b } = countTeams(assignments)
  if (team_a !== team_b) {
    throw new Error(`Team assignment failed: uneven teams (${team_a} vs ${team_b})`)
  }
}

export function makeLadder(count: number, baseElo = 1200, step = 10): MatchmakingPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${String(i).padStart(2, '0')}`,
    elo: baseElo + i * step,
  }))
}

export function makeKillsLadder(
  count: number,
  baseAvgKills = 5,
  step = 1
): KillsMatchmakingPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${String(i).padStart(2, '0')}`,
    avgKillsPerScrim: baseAvgKills + i * step,
  }))
}

export function makeSkillLadder(
  count: number,
  baseElo = 1200,
  eloStep = 10,
  baseAvgKills = 5,
  killsStep = 1
): SkillBasedPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${String(i).padStart(2, '0')}`,
    elo: baseElo + i * eloStep,
    avgKillsPerScrim: baseAvgKills + i * killsStep,
  }))
}
