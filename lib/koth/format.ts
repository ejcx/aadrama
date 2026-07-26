export type KothFormat = 1 | 2 | 3

export type KothFormatLabel = '1v1' | '2v2' | '3v3'

export function formatLabel(format: KothFormat): KothFormatLabel {
  return `${format}v${format}` as KothFormatLabel
}

export function parseFormat(value: string | number): KothFormat | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return null
}

export function playersPerTeam(format: KothFormat): number {
  return format
}

export function totalPlayersNeeded(format: KothFormat): number {
  return format * 2
}
