/** Preset maps allowed for King of the Hill matches. */
export const KOTH_MAPS = [
  'MOUT McKenna',
  'Pool Day',
  'Pipeline',
  'Insurgent Camp',
  'Rummage',
  'District',
] as const

export type KothMap = (typeof KOTH_MAPS)[number]

export function isKothMap(map: string): map is KothMap {
  return (KOTH_MAPS as readonly string[]).includes(map)
}
