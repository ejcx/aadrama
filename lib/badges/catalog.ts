import type { BadgeType } from './constants'
import { BADGE_TYPES, getBadgeMeta } from './constants'

/** Badges that can be earned multiple times (once per scrim or manual award). */
export const REPEATABLE_BADGE_TYPES = new Set<BadgeType>([
  'potato',
  'scrim_top_frag',
  'rage_quit',
])

export function isRepeatableBadgeType(badgeType: string): boolean {
  return REPEATABLE_BADGE_TYPES.has(badgeType as BadgeType)
}

export type BadgeCatalogSection = {
  title: string
  badgeTypes: BadgeType[]
}

/** Display order and grouping for the badge catalog page. */
export const BADGE_CATALOG_SECTIONS: BadgeCatalogSection[] = [
  {
    title: 'Scrim Awards',
    badgeTypes: ['potato', 'scrim_top_frag', 'rage_quit'],
  },
  {
    title: 'Streaks',
    badgeTypes: ['vitality'],
  },
  {
    title: 'ELO',
    badgeTypes: [
      'held_first_place',
      'elo_milestone_1300',
      'elo_milestone_1350',
      'elo_milestone_1400',
      'elo_milestone_1450',
    ],
  },
  {
    title: 'Activity',
    badgeTypes: [
      'season_1_combat_patch',
      'scrimlord',
      'cal_i_activity_confirmed',
      'keeping_the_game_alive',
      'always_online',
      'scrim_activity_500',
      'scrim_activity_1000',
    ],
  },
  {
    title: 'Season 1',
    badgeTypes: [
      'season_1_champion',
      'season_1_top_10',
      'season_1_elite',
      'season_1_active',
    ],
  },
]

const catalogTypeSet = new Set(
  BADGE_CATALOG_SECTIONS.flatMap((section) => section.badgeTypes)
)

/** Badge types shown on the catalog that are not in a section yet. */
export function remainingCatalogBadgeTypes(): BadgeType[] {
  return BADGE_TYPES.filter((type) => !catalogTypeSet.has(type))
}

export function orderedCatalogBadgeTypes(): BadgeType[] {
  const ordered = BADGE_CATALOG_SECTIONS.flatMap((section) => section.badgeTypes)
  return [...ordered, ...remainingCatalogBadgeTypes()]
}

export type BadgeHolderSummary = {
  game_name: string
  game_name_lower: string
  count: number
  firstEarnedAt: string
  lastEarnedAt: string
}

export type BadgeCatalogEntry = {
  badgeType: BadgeType
  label: string
  description: string
  src: string
  accent: string
  repeatable: boolean
  uniqueHolders: number
  totalAwards: number
  holders: BadgeHolderSummary[]
}

export function buildBadgeCatalogEntry(
  badgeType: BadgeType,
  holders: BadgeHolderSummary[]
): BadgeCatalogEntry {
  const meta = getBadgeMeta(badgeType)
  const repeatable = isRepeatableBadgeType(badgeType)
  const totalAwards = holders.reduce((sum, holder) => sum + holder.count, 0)

  const sortedHolders = [...holders].sort((a, b) => {
    if (repeatable && b.count !== a.count) return b.count - a.count
    return new Date(b.lastEarnedAt).getTime() - new Date(a.lastEarnedAt).getTime()
  })

  return {
    badgeType,
    label: meta.label,
    description: meta.description,
    src: meta.src,
    accent: meta.accent,
    repeatable,
    uniqueHolders: holders.length,
    totalAwards,
    holders: sortedHolders,
  }
}
