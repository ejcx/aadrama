/** Badges only apply to scrims finalized on or after this instant (go-forward). */
export const BADGES_GO_FORWARD_CUTOFF = new Date('2026-05-16T00:00:00.000Z')

export const BADGE_TYPES = [
  'potato',
  'season_1_champion',
  'season_1_top_10',
  'season_1_combat_patch',
  'season_1_elite',
  'season_1_active',
  'held_first_place',
  'scrim_top_frag',
  'scrimlord',
  'cal_i_activity_confirmed',
  'keeping_the_game_alive',
  'always_online',
] as const

export type BadgeType = (typeof BADGE_TYPES)[number]

export type BadgeMeta = {
  label: string
  description: string
  src: string
  /** Ribbon / accent color for the rack display */
  accent: string
}

export const BADGE_META: Record<BadgeType, BadgeMeta> = {
  potato: {
    label: 'Potato',
    description: 'Voted worst performer by the losing team, or earned with a heroic 1-kill game.',
    src: '/badges/potato.svg',
    accent: '#a06a36',
  },
  season_1_champion: {
    label: 'Season 1 Champion',
    description: 'Season 1 ranked champion.',
    src: '/badges/season-1-champion.svg',
    accent: '#fbbf24',
  },
  season_1_top_10: {
    label: 'Season 1 Top 10',
    description: 'Finished Season 1 ranked in the top 10 on the ELO leaderboard.',
    src: '/badges/season-1-top-10.svg',
    accent: '#94a3b8',
  },
  season_1_combat_patch: {
    label: 'Season 1 Combat Patch',
    description: 'Participated in Season 1 scrims.',
    src: '/badges/season-1-combat-patch.svg',
    accent: '#a3a38f',
  },
  season_1_elite: {
    label: 'Season 1 Elite',
    description: 'Season 1 elite competitor.',
    src: '/badges/season-1-elite.svg',
    accent: '#a855f7',
  },
  season_1_active: {
    label: 'Season 1 Active',
    description: 'Active participant throughout Season 1.',
    src: '/badges/season-1-active.svg',
    accent: '#22d3ee',
  },
  held_first_place: {
    label: '#1 ELO',
    description: 'Held the #1 spot on the global ELO leaderboard.',
    src: '/badges/held-first-place.svg',
    accent: '#f59e0b',
  },
  scrim_top_frag: {
    label: 'Scrim Top Frag',
    description: 'Most kills in the scrim.',
    src: '/badges/scrim-top-frag.svg',
    accent: '#ef4444',
  },
  scrimlord: {
    label: 'Scrimlord',
    description: 'Played 50 or more scrims in Season 1.',
    src: '/badges/scrimlord.svg',
    accent: '#84cc16',
  },
  cal_i_activity_confirmed: {
    label: 'Cal-I Activity Confirmed',
    description: 'Played 100 or more scrims in Season 1.',
    src: '/badges/cal-i-activity-confirmed.svg',
    accent: '#38bdf8',
  },
  keeping_the_game_alive: {
    label: 'Keeping the Game Alive',
    description: 'Played 200 or more scrims in Season 1.',
    src: '/badges/keeping-the-game-alive.svg',
    accent: '#f97316',
  },
  always_online: {
    label: 'Always Online',
    description: 'Played 300 or more scrims in Season 1.',
    src: '/badges/always-online.svg',
    accent: '#22c55e',
  },
}

export function isBadgeGoForward(finalizedAt: string | null | undefined): boolean {
  if (!finalizedAt) return false
  return new Date(finalizedAt) >= BADGES_GO_FORWARD_CUTOFF
}

const FALLBACK_BADGE_META: BadgeMeta = {
  label: 'Award',
  description: 'Special recognition.',
  src: '/badges/season-1-active.svg',
  accent: '#9ca3af',
}

export function getBadgeMeta(badgeType: string): BadgeMeta {
  if (badgeType in BADGE_META) {
    return BADGE_META[badgeType as BadgeType]
  }
  return {
    ...FALLBACK_BADGE_META,
    label: badgeType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}
