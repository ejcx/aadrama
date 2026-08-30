/** Ranked scrims are even-sided from 4v4 through 8v8. */
export const SCRIM_FORMATS = [4, 5, 6, 7, 8] as const

export type ScrimFormat = (typeof SCRIM_FORMATS)[number]

export function isScrimFormat(value: number): value is ScrimFormat {
  return (SCRIM_FORMATS as readonly number[]).includes(value)
}

export function formatLabel(format: ScrimFormat): string {
  return `${format}v${format}`
}

export function playerCountForFormat(format: ScrimFormat): number {
  return format * 2
}

export function formatFromPlayerCount(playerCount: number): ScrimFormat | null {
  if (playerCount <= 0 || playerCount % 2 !== 0) return null
  const perTeam = playerCount / 2
  return isScrimFormat(perTeam) ? perTeam : null
}

export function formatLabelFromPlayerCount(playerCount: number): string {
  const format = formatFromPlayerCount(playerCount)
  return format ? formatLabel(format) : `${playerCount} players`
}
