/** Season 2 ranked scrims began May 16, 2026 at 1:00 PM US Eastern. */
export const SEASON_2_START_ISO = '2026-05-16T17:00:00.000Z'

/** Season 1 ended when Season 2 began (exclusive cutoff for S1 ranked games). */
export const SEASON_1_END_ISO = SEASON_2_START_ISO

export const SEASON_1_LABEL = 'Season 1'
export const SEASON_2_LABEL = 'Season 2'

/** Human-readable Season 1 end / Season 2 start for UI copy. */
export const SEASON_1_END_DISPLAY = 'May 16, 2026 at 1:00 PM Eastern'

const ELO_BASE = 1200

/** Final Season 1 rating from ranked games before Season 2 started. */
export function season1EloFromChanges(eloChangeSum: number): number {
  return ELO_BASE + eloChangeSum
}

/** True when a finalized scrim counts toward Season 1 ranked ELO (frozen). */
export function isSeason1Scrim(finalizedAt: string | null | undefined): boolean {
  if (!finalizedAt) return false
  return new Date(finalizedAt).getTime() < new Date(SEASON_1_END_ISO).getTime()
}

/** True when a finalized scrim counts toward Season 2 ranked ELO. */
export function isSeason2Scrim(finalizedAt: string | null | undefined): boolean {
  if (!finalizedAt) return false
  return new Date(finalizedAt).getTime() >= new Date(SEASON_2_START_ISO).getTime()
}
