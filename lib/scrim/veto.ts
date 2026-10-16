/**
 * Veto map choice: 4 maps are drawn from the tiered pool and players vote on
 * them in the lobby, before teams are picked.
 *
 * The draw and the result are decided in the database
 * (supabase/migrations/20261008_001_scrim_map_veto.sql). These helpers only
 * shape that data for display.
 */

import { TIERED_MAPS } from './tiered-maps'

export interface VetoVote {
  user_name: string
  veto_map_vote: string | null
}

export interface VetoOptionTally {
  map: string
  votes: number
  voters: string[]
}

/** Votes per offered map, in the order the maps were offered. Votes for anything else are ignored. */
export function tallyVetoVotes(options: readonly string[], votes: readonly VetoVote[]): VetoOptionTally[] {
  return options.map((map) => {
    const voters = votes.filter((v) => v.veto_map_vote === map).map((v) => v.user_name)
    return { map, votes: voters.length, voters }
  })
}

/** Maps currently tied for the most votes (empty when nobody has voted). */
export function vetoLeaders(tally: readonly VetoOptionTally[]): string[] {
  const top = Math.max(0, ...tally.map((t) => t.votes))
  if (top === 0) return []
  return tally.filter((t) => t.votes === top).map((t) => t.map)
}

/** The tally with a vote that was just cast but not saved yet, so the click shows at once. */
export function tallyWithPendingVote(
  tally: readonly VetoOptionTally[],
  currentVote: string | null,
  pendingVote: string | null
): VetoOptionTally[] {
  if (!pendingVote || pendingVote === currentVote || !tally.some((t) => t.map === pendingVote)) {
    return [...tally]
  }
  return tally.map((t) => {
    if (t.map === pendingVote) return { ...t, votes: t.votes + 1 }
    if (t.map === currentVote) return { ...t, votes: Math.max(0, t.votes - 1) }
    return t
  })
}

const TIERED_MAP_NAMES = new Set(TIERED_MAPS.map((m) => m.name))

/** Loading-screen image for a tiered-pool map (public/maps), or null for any other map. */
export function mapImagePath(map: string): string | null {
  if (!TIERED_MAP_NAMES.has(map)) return null
  const slug = map.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `/maps/${slug}.webp`
}
