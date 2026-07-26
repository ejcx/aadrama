import type { KothFormat } from './format'

/** Preset maps allowed for King of the Hill matches (2v2 / 3v3). */
export const KOTH_MAPS = [
  'MOUT McKenna',
  'Pool Day',
  'Pipeline',
  'Insurgent Camp',
  'Rummage',
  'District',
  'Collapsed Tunnel',
  'Bridge Crossing',
  'Aztec',
  'Dusk',
  'SF CSAR',
  'Swamp Raid',
] as const

/** 1v1 is Pool Day only. */
export const KOTH_1V1_MAPS = ['Pool Day'] as const

export type KothMap = (typeof KOTH_MAPS)[number]

export function getKothMapsForFormat(format: KothFormat): readonly string[] {
  if (format === 1) return KOTH_1V1_MAPS
  return KOTH_MAPS
}

export function isKothMap(map: string): map is KothMap {
  return (KOTH_MAPS as readonly string[]).includes(map)
}

export function isKothMapForFormat(format: KothFormat, map: string): boolean {
  return getKothMapsForFormat(format).includes(map)
}
