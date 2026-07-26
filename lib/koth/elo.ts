export type KothMatchResult = 'win' | 'loss' | 'draw'

export function calculateKothKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40
  if (gamesPlayed < 30) return 32
  if (gamesPlayed < 50) return 24
  return 16
}

export function calculateExpectedScore(teamElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / 400))
}

/**
 * Team ELO change with score-margin multiplier (no individual kill share).
 * Mirrors scrim K-factor tiers and margin scaling.
 */
export function calculateTeamEloChange(params: {
  teamElo: number
  opponentElo: number
  result: KothMatchResult
  teamScore: number
  opponentScore: number
  gamesPlayed: number
}): { change: number; kFactor: number } {
  const kFactor = calculateKothKFactor(params.gamesPlayed)
  const expected = calculateExpectedScore(params.teamElo, params.opponentElo)
  const actual = params.result === 'win' ? 1 : params.result === 'draw' ? 0.5 : 0
  const base = kFactor * (actual - expected)
  const margin =
    1 + Math.log(1 + Math.abs(params.teamScore - params.opponentScore)) / 4
  return { change: Math.round(base * margin), kFactor }
}
