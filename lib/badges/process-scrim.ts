import type { SupabaseClient } from '@supabase/supabase-js'
import type { Scrim, Winner } from '@/lib/supabase/types'
import { awardBadge, hasBadgeForSession } from './award'
import { isBadgeGoForward } from './constants'

export type ScrimPlayerKillStats = {
  gameName: string
  gameNameLower: string
  kills: number
  team: string | null
}

export async function processScrimAutoBadges(
  supabase: SupabaseClient,
  scrim: Scrim,
  playerStats: ScrimPlayerKillStats[]
): Promise<{ potatoAutoAwarded: string[] }> {
  const result = { potatoAutoAwarded: [] as string[] }

  if (scrim.status !== 'finalized' || !isBadgeGoForward(scrim.finalized_at)) {
    return result
  }

  if (scrim.auto_badges_processed_at) {
    return result
  }

  if (playerStats.length === 0) {
    return result
  }

  const sessionId = scrim.id

  for (const player of playerStats) {
    if (player.kills === 1) {
      const { awarded } = await awardBadge(supabase, {
        badgeType: 'potato',
        gameName: player.gameName,
        gameNameLower: player.gameNameLower,
        sessionId,
        earnedAt: scrim.finalized_at ?? undefined,
      })
      if (awarded) result.potatoAutoAwarded.push(player.gameNameLower)
    }
  }

  await supabase
    .from('scrims')
    .update({ auto_badges_processed_at: new Date().toISOString() })
    .eq('id', scrim.id)

  return result
}

export function getLosingTeam(winner: Winner | null): 'team_a' | 'team_b' | null {
  if (winner === 'team_a') return 'team_b'
  if (winner === 'team_b') return 'team_a'
  return null
}

/** Losing team needs all but one member voting for the same target. */
export function potatoVotesNeeded(losingTeamSize: number): number {
  if (losingTeamSize <= 0) return 0
  return Math.max(1, losingTeamSize - 1)
}

export async function tryAwardPotatoFromVotes(
  supabase: SupabaseClient,
  scrim: Scrim,
  losingTeamSize: number
): Promise<{ awarded: boolean; winnerGameNameLower?: string }> {
  if (!isBadgeGoForward(scrim.finalized_at)) {
    return { awarded: false }
  }

  if (await hasBadgeForSession(supabase, 'potato', scrim.id)) {
    return { awarded: false }
  }

  const needed = potatoVotesNeeded(losingTeamSize)
  if (needed === 0) return { awarded: false }

  const { data: votes, error } = await supabase
    .from('scrim_potato_votes')
    .select('voted_for_game_name, voted_for_game_name_lower')
    .eq('scrim_id', scrim.id)

  if (error || !votes?.length) {
    return { awarded: false }
  }

  const counts = new Map<string, { name: string; count: number }>()
  for (const v of votes) {
    const key = v.voted_for_game_name_lower
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { name: v.voted_for_game_name, count: 1 })
    }
  }

  let best: { name: string; lower: string; count: number } | null = null
  for (const [lower, { name, count }] of Array.from(counts.entries())) {
    if (!best || count > best.count) {
      best = { name, lower, count }
    }
  }

  if (!best || best.count < needed) {
    return { awarded: false }
  }

  const { awarded } = await awardBadge(supabase, {
    badgeType: 'potato',
    gameName: best.name,
    gameNameLower: best.lower,
    sessionId: scrim.id,
    earnedAt: scrim.finalized_at ?? undefined,
  })

  return { awarded, winnerGameNameLower: best.lower }
}
