import type { PlayerBadge } from '@/lib/supabase/types'
import type { BadgeType } from './constants'

/** Peak cumulative ELO tiers — one milestone badge per player (highest tier only). */
export const ELO_MILESTONE_TIERS = [
  { threshold: 1300, badgeType: 'elo_milestone_1300' as const },
  { threshold: 1350, badgeType: 'elo_milestone_1350' as const },
  { threshold: 1400, badgeType: 'elo_milestone_1400' as const },
  { threshold: 1450, badgeType: 'elo_milestone_1450' as const },
] as const

export const ELO_MILESTONE_BADGE_TYPES: readonly BadgeType[] = ELO_MILESTONE_TIERS.map(
  (t) => t.badgeType
)

export const ELO_MILESTONE_SESSION_ID = 'elo-milestone'

export function isEloMilestoneBadgeType(badgeType: string): badgeType is BadgeType {
  return (ELO_MILESTONE_BADGE_TYPES as readonly string[]).includes(badgeType)
}

export function eloMilestoneTierIndex(badgeType: string): number {
  return ELO_MILESTONE_TIERS.findIndex((t) => t.badgeType === badgeType)
}

export function badgeTypeForPeakElo(peakElo: number): BadgeType | null {
  let match: BadgeType | null = null
  for (const tier of ELO_MILESTONE_TIERS) {
    if (peakElo >= tier.threshold) {
      match = tier.badgeType
    }
  }
  return match
}

/** Pick the single ELO milestone badge to display (highest tier if duplicates exist). */
export function pickEloMilestoneBadge(badges: PlayerBadge[]): PlayerBadge | null {
  let best: PlayerBadge | null = null
  let bestIndex = -1

  for (const badge of badges) {
    if (!isEloMilestoneBadgeType(badge.badge_type)) continue
    const index = eloMilestoneTierIndex(badge.badge_type)
    if (index > bestIndex) {
      bestIndex = index
      best = badge
    }
  }

  return best
}
