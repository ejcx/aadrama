/** Season 2 ranked scrims began May 16, 2026 at 1:00 PM US Eastern. */
export const SEASON_2_START_ISO = '2026-05-16T17:00:00.000Z'

export const SEASON_1_LABEL = 'Season 1'
export const SEASON_2_LABEL = 'Season 2'

const ELO_BASE = 1200

/** Final Season 1 rating from ranked games before Season 2 started. */
export function season1EloFromChanges(eloChangeSum: number): number {
  return ELO_BASE + eloChangeSum
}
