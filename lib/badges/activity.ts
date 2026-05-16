import type { PlayerBadge } from '@/lib/supabase/types'
import type { BadgeType } from './constants'

/** Ranked scrim count tiers — one activity badge per player (highest tier only). */
export const SCRIM_ACTIVITY_TIERS = [
  { threshold: 50, badgeType: 'scrimlord' as const },
  { threshold: 100, badgeType: 'cal_i_activity_confirmed' as const },
  { threshold: 200, badgeType: 'keeping_the_game_alive' as const },
  { threshold: 300, badgeType: 'always_online' as const },
  { threshold: 500, badgeType: 'scrim_activity_500' as const },
  { threshold: 1000, badgeType: 'scrim_activity_1000' as const },
] as const

export const SCRIM_ACTIVITY_BADGE_TYPES: readonly BadgeType[] = SCRIM_ACTIVITY_TIERS.map(
  (t) => t.badgeType
)

export const SCRIM_ACTIVITY_SESSION_ID = 'scrim-activity'

export function isScrimActivityBadgeType(badgeType: string): badgeType is BadgeType {
  return (SCRIM_ACTIVITY_BADGE_TYPES as readonly string[]).includes(badgeType)
}

export function scrimActivityTierIndex(badgeType: string): number {
  return SCRIM_ACTIVITY_TIERS.findIndex((t) => t.badgeType === badgeType)
}

export function badgeTypeForScrimCount(count: number): BadgeType | null {
  let match: BadgeType | null = null
  for (const tier of SCRIM_ACTIVITY_TIERS) {
    if (count >= tier.threshold) {
      match = tier.badgeType
    }
  }
  return match
}

/** Pick the single activity badge to display (highest tier if duplicates exist). */
export function pickScrimActivityBadge(badges: PlayerBadge[]): PlayerBadge | null {
  let best: PlayerBadge | null = null
  let bestIndex = -1

  for (const badge of badges) {
    if (!isScrimActivityBadgeType(badge.badge_type)) continue
    const index = scrimActivityTierIndex(badge.badge_type)
    if (index > bestIndex) {
      bestIndex = index
      best = badge
    }
  }

  return best
}
