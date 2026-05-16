import type { SupabaseClient } from '@supabase/supabase-js'
import type { BadgeType } from './constants'

export async function awardBadge(
  supabase: SupabaseClient,
  params: {
    badgeType: BadgeType
    gameName: string
    gameNameLower: string
    sessionId: string
    earnedAt?: string
  }
): Promise<{ awarded: boolean; error?: string }> {
  const { badgeType, gameName, gameNameLower, sessionId, earnedAt } = params

  const { error } = await supabase.from('player_badges').insert({
    badge_type: badgeType,
    game_name: gameName,
    game_name_lower: gameNameLower,
    session_id: sessionId,
    ...(earnedAt ? { earned_at: earnedAt } : {}),
  })

  if (error) {
    if (error.code === '23505') {
      return { awarded: false }
    }
    return { awarded: false, error: error.message }
  }

  return { awarded: true }
}

export async function hasBadgeForSession(
  supabase: SupabaseClient,
  badgeType: BadgeType,
  sessionId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('player_badges')
    .select('id', { count: 'exact', head: true })
    .eq('badge_type', badgeType)
    .eq('session_id', sessionId)

  if (error) {
    console.error('hasBadgeForSession:', error)
    return false
  }

  return (count ?? 0) > 0
}
