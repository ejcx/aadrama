/** Badges only apply to scrims finalized on or after this instant (go-forward). */
export const BADGES_GO_FORWARD_CUTOFF = new Date('2026-05-16T00:00:00.000Z')

export const BADGE_TYPES = [
  'potato',
  'rage_quit',
  'season_1_champion',
  'season_1_top_10',
  'season_1_combat_patch',
  'season_1_elite',
  'season_1_active',
  'held_first_place',
  'elo_milestone_1300',
  'elo_milestone_1350',
  'elo_milestone_1400',
  'elo_milestone_1450',
  'scrim_top_frag',
  'scrimlord',
  'cal_i_activity_confirmed',
  'keeping_the_game_alive',
  'always_online',
  'scrim_activity_500',
  'scrim_activity_1000',
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
  rage_quit: {
    label: 'Rage Quit',
    description: 'Left a scrim early or bailed mid-match. Manually awarded.',
    src: '/badges/rage-quit.svg',
    accent: '#ef4444',
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
    description: 'Played ranked scrims before reaching the Scrimlord tier (fewer than 50).',
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
    description: 'Reached #1 on the global ELO leaderboard. Scrims at #1 counts ranked games finished while tied for first.',
    src: '/badges/held-first-place.svg',
    accent: '#f59e0b',
  },
  elo_milestone_1300: {
    label: 'ELO 1300',
    description: 'Reached 1300 cumulative ranked ELO.',
    src: '/badges/elo-milestone-1300.svg',
    accent: '#78716c',
  },
  elo_milestone_1350: {
    label: 'ELO 1350',
    description: 'Reached 1350 cumulative ranked ELO.',
    src: '/badges/elo-milestone-1350.svg',
    accent: '#d97706',
  },
  elo_milestone_1400: {
    label: 'ELO 1400',
    description: 'Reached 1400 cumulative ranked ELO.',
    src: '/badges/elo-milestone-1400.svg',
    accent: '#94a3b8',
  },
  elo_milestone_1450: {
    label: 'ELO 1450',
    description: 'Reached 1450 cumulative ranked ELO.',
    src: '/badges/elo-milestone-1450.svg',
    accent: '#eab308',
  },
  scrim_top_frag: {
    label: 'Scrim Top Frag',
    description: 'Most kills in the scrim.',
    src: '/badges/scrim-top-frag.svg',
    accent: '#ef4444',
  },
  scrimlord: {
    label: 'Scrimlord',
    description: 'Played 50 or more ranked scrims.',
    src: '/badges/scrimlord.svg',
    accent: '#84cc16',
  },
  cal_i_activity_confirmed: {
    label: 'Cal-I Activity Confirmed',
    description: 'Played 100 or more ranked scrims.',
    src: '/badges/cal-i-activity-confirmed.svg',
    accent: '#38bdf8',
  },
  keeping_the_game_alive: {
    label: 'Keeping the Game Alive',
    description: 'Played 200 or more ranked scrims.',
    src: '/badges/keeping-the-game-alive.svg',
    accent: '#f97316',
  },
  always_online: {
    label: 'Always Online',
    description: 'Played 300 or more ranked scrims.',
    src: '/badges/always-online.svg',
    accent: '#22c55e',
  },
  scrim_activity_500: {
    label: 'Scrim Veteran',
    description: 'Played 500 or more ranked scrims.',
    src: '/badges/scrim-activity-500.svg',
    accent: '#a855f7',
  },
  scrim_activity_1000: {
    label: 'Scrim Legend',
    description: 'Played 1,000 or more ranked scrims.',
    src: '/badges/scrim-activity-1000.svg',
    accent: '#f59e0b',
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
