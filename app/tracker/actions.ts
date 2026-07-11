'use server'

import {
  type BadgeCatalogEntry,
  type BadgeHolderSummary,
  buildBadgeCatalogEntry,
  orderedCatalogBadgeTypes,
} from '@/lib/badges/catalog'
import type { PlayerBadge } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { SEASON_2_START_ISO, season1EloFromChanges } from '@/lib/scrim/seasons'
import {
  comparisonNeedsFullScrimRoster,
  computeTeammateStats,
  mergeRankedGames,
  type RankedGame,
  type TeammateComparisonInput,
  type TeammateComparisonMode,
  type TeammateStatsResult,
} from '@/lib/tracker/teammate-stats'

export type {
  TeammateComparisonInput,
  TeammateComparisonMode,
  TeammateStatsResult,
}

function parseTrackerSessionIds(trackerSessionId: string): string[] {
  return trackerSessionId.split(/[+~\s]+/).map((id) => id.trim()).filter(Boolean)
}

function computeKdRatio(kills: number, deaths: number): number {
  if (deaths > 0) return Math.round((kills / deaths) * 100) / 100
  if (kills > 0) return 999.99
  return 0
}

function computeFragsPerScrim(kills: number, games: number): number | null {
  if (games <= 0) return null
  return Math.round((10 * kills) / games) / 10
}

const ELO_HISTORY_PAGE_SIZE = 1000

type EloHistoryAggRow = {
  game_name_lower: string
  scrim_id: string
  elo_change: number | null
  result: string
  kills: number | null
}

const SCRIM_ID_CHUNK = 80
const SESSION_ID_CHUNK = 80

/** Paginated elo_history fetch (Supabase caps at 1000 rows per request). */
async function fetchSeasonEloHistory(season: 1 | 2): Promise<EloHistoryAggRow[]> {
  const supabase = await createClient()
  const rows: EloHistoryAggRow[] = []

  for (let from = 0; ; from += ELO_HISTORY_PAGE_SIZE) {
    let query = supabase
      .from('elo_history')
      .select('game_name_lower, scrim_id, elo_change, result, kills')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ELO_HISTORY_PAGE_SIZE - 1)

    query =
      season === 1
        ? query.lt('created_at', SEASON_2_START_ISO)
        : query.gte('created_at', SEASON_2_START_ISO)

    const { data, error } = await query

    if (error) {
      throw new Error(
        `Failed to fetch Season ${season} ELO history: ${error.message}`
      )
    }

    const page = (data ?? []) as EloHistoryAggRow[]
    rows.push(...page)
    if (page.length < ELO_HISTORY_PAGE_SIZE) break
  }

  return rows
}

async function getRankedKillsByPlayer(
  gameNames: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (gameNames.length === 0) return result

  const names = Array.from(
    new Set(gameNames.map((n) => n.toLowerCase().trim()).filter(Boolean))
  )
  const supabase = await createClient()

  try {
    for (let from = 0; ; from += ELO_HISTORY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('elo_history')
        .select('game_name_lower, kills')
        .in('game_name_lower', names)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + ELO_HISTORY_PAGE_SIZE - 1)

      if (error) {
        console.error('Failed to fetch ranked kills:', error.message)
        break
      }

      const page = data ?? []
      for (const row of page) {
        const key = row.game_name_lower
        result.set(key, (result.get(key) ?? 0) + (row.kills ?? 0))
      }
      if (page.length < ELO_HISTORY_PAGE_SIZE) break
    }
  } catch (err) {
    console.error('Failed to fetch ranked kills:', err)
  }

  return result
}

// Search for players by name (case-insensitive substring match)
export interface PlayerSearchResult {
  name: string
  total_kills: number
  total_deaths: number
}

export async function searchPlayers(query: string, limit = 10): Promise<PlayerSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return []
  }

  const supabase = await createClient()
  const searchTerm = query.toLowerCase().trim()

  // Search in player_total_stats_mv (materialized view with pre-aggregated stats)
  // This eliminates client-side aggregation and improves performance significantly
  const { data, error } = await supabase
    .from('player_total_stats_mv')
    .select('player_name, total_kills, total_deaths')
    .ilike('player_name', `%${searchTerm}%`)
    .order('total_kills', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to search players:', error)
    return []
  }

  // Map to expected return type
  return data?.map(p => ({
    name: p.player_name,
    total_kills: p.total_kills,
    total_deaths: p.total_deaths,
  })) || []
}

// Get ELO leaderboard with top players (includes scrim kills/deaths)
export async function getEloLeaderboard(limit = 100) {
  const supabase = await createClient()

  // Fetch ELO data first (required)
  const eloResult = await supabase
    .from('player_elo')
    .select('*')
    .order('elo', { ascending: false })
    .limit(limit)

  if (eloResult.error) throw new Error(`Failed to fetch ELO leaderboard: ${eloResult.error.message}`)

  const gameNames = (eloResult.data || []).map((p) => p.game_name_lower)
  const statsMap = new Map<string, { total_kills: number; total_deaths: number; kd_ratio: number }>()

  if (gameNames.length > 0) {
    try {
      const nameChunkSize = 100
      for (let i = 0; i < gameNames.length; i += nameChunkSize) {
        const nameChunk = gameNames.slice(i, i + nameChunkSize)
        const { data, error } = await supabase
          .from('player_scrim_stats_mv')
          .select('player_name_lower, total_scrim_kills, total_scrim_deaths, scrim_kd_ratio')
          .in('player_name_lower', nameChunk)

        if (error) {
          console.error('Failed to fetch player scrim stats:', error.message)
          break
        }
        for (const stat of data || []) {
          statsMap.set(stat.player_name_lower, {
            total_kills: stat.total_scrim_kills,
            total_deaths: stat.total_scrim_deaths,
            kd_ratio: stat.scrim_kd_ratio,
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch player stats from materialized view:', err)
    }
  }
  const rankedKillsMap = await getRankedKillsByPlayer(gameNames)

  // Merge ELO data with scrim stats (use defaults if stats not available)
  const enrichedData = (eloResult.data || []).map((player) => {
    const stats = statsMap.get(player.game_name_lower)
    const rankedKills = rankedKillsMap.get(player.game_name_lower) ?? 0
    return {
      ...player,
      total_kills: stats?.total_kills || 0,
      total_deaths: stats?.total_deaths || 0,
      kd_ratio: stats?.kd_ratio || 0,
      ranked_kills: rankedKills,
      frags_per_scrim: computeFragsPerScrim(rankedKills, player.games_played),
    }
  })

  return enrichedData
}

// Get 7-day ELO changes for multiple players
export async function getEloChanges7Days(gameNames: string[]) {
  const supabase = await createClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: historyRecords, error } = await supabase
    .from('elo_history')
    .select('game_name_lower, elo_change')
    .in('game_name_lower', gameNames)
    .gte('created_at', sevenDaysAgo.toISOString())

  if (error) throw new Error(`Failed to fetch ELO changes: ${error.message}`)
  return historyRecords || []
}

export type EloLeaderboardRow = Awaited<ReturnType<typeof getEloLeaderboard>>[number]

/** Season leaderboard: 1200 + sum(elo_change) and W-L-D for ranked games in that season. */
async function getSeasonEloLeaderboard(
  season: 1 | 2,
  limit: number
): Promise<EloLeaderboardRow[]> {
  const supabase = await createClient()
  const history = await fetchSeasonEloHistory(season)

  const agg = new Map<
    string,
    { wins: number; losses: number; draws: number; eloSum: number; kills: number }
  >()
  const scrimIds = new Set<string>()

  for (const row of history) {
    scrimIds.add(row.scrim_id)
    const existing = agg.get(row.game_name_lower) || {
      wins: 0,
      losses: 0,
      draws: 0,
      eloSum: 0,
      kills: 0,
    }
    if (row.result === 'win') existing.wins++
    else if (row.result === 'loss') existing.losses++
    else existing.draws++
    existing.eloSum += row.elo_change ?? 0
    existing.kills += row.kills ?? 0
    agg.set(row.game_name_lower, existing)
  }

  if (agg.size === 0) return []

  const gameNames = Array.from(agg.keys())
  const nameMap = new Map<string, string>()
  const nameChunkSize = 100
  for (let i = 0; i < gameNames.length; i += nameChunkSize) {
    const chunk = gameNames.slice(i, i + nameChunkSize)
    const { data: eloRecords, error: namesError } = await supabase
      .from('player_elo')
      .select('game_name, game_name_lower')
      .in('game_name_lower', chunk)

    if (namesError) {
      throw new Error(`Failed to fetch player names: ${namesError.message}`)
    }
    for (const r of eloRecords || []) {
      nameMap.set(r.game_name_lower, r.game_name)
    }
  }
  const kdMap = await getRankedScrimKdStats(Array.from(scrimIds), gameNames)

  const results: EloLeaderboardRow[] = Array.from(agg.entries()).map(([gameNameLower, stats]) => {
    const kd = kdMap.get(gameNameLower)
    const gamesPlayed = stats.wins + stats.losses + stats.draws
    return {
      game_name: nameMap.get(gameNameLower) || gameNameLower,
      game_name_lower: gameNameLower,
      elo: season1EloFromChanges(stats.eloSum),
      games_played: gamesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      total_kills: kd?.total_kills ?? stats.kills,
      total_deaths: kd?.total_deaths ?? 0,
      kd_ratio: kd?.kd_ratio ?? computeKdRatio(stats.kills, 0),
      ranked_kills: stats.kills,
      frags_per_scrim: computeFragsPerScrim(stats.kills, gamesPlayed),
    }
  })

  results.sort((a, b) => b.elo - a.elo || b.games_played - a.games_played)
  return results.slice(0, limit)
}

/** Frozen Season 1 leaderboard (ranked games before Season 2 start). */
export async function getSeason1EloLeaderboard(limit = 100): Promise<EloLeaderboardRow[]> {
  return getSeasonEloLeaderboard(1, limit)
}

/** Season 2 leaderboard: 1200 + sum(elo_change) and W-L-D from ranked games since season start. */
export async function getSeason2EloLeaderboard(limit = 100): Promise<EloLeaderboardRow[]> {
  return getSeasonEloLeaderboard(2, limit)
}

async function getTrackerSessionIdsForScrims(
  scrimIds: string[]
): Promise<Set<string>> {
  const sessionIds = new Set<string>()
  if (scrimIds.length === 0) return sessionIds

  const supabase = await createClient()
  const uniqueIds = Array.from(new Set(scrimIds))

  for (let i = 0; i < uniqueIds.length; i += SCRIM_ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + SCRIM_ID_CHUNK)
    const { data, error } = await supabase
      .from('scrims')
      .select('tracker_session_id')
      .in('id', chunk)
      .not('tracker_session_id', 'is', null)

    if (error) {
      console.error('Failed to fetch scrim tracker sessions:', error.message)
      continue
    }

    for (const scrim of data || []) {
      if (!scrim.tracker_session_id) continue
      for (const id of parseTrackerSessionIds(scrim.tracker_session_id)) {
        sessionIds.add(id)
      }
    }
  }

  return sessionIds
}

async function aggregatePlayerStatsKd(
  sessionIds: Set<string>,
  allowedPlayers: Set<string> | null
): Promise<Map<string, { kills: number; deaths: number }>> {
  const agg = new Map<string, { kills: number; deaths: number }>()
  const list = Array.from(sessionIds)
  if (list.length === 0) return agg

  const supabase = await createClient()

  for (let i = 0; i < list.length; i += SESSION_ID_CHUNK) {
    const sessionChunk = list.slice(i, i + SESSION_ID_CHUNK)

    for (let from = 0; ; from += ELO_HISTORY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('player_stats')
        .select('name, kills, deaths')
        .in('session_id', sessionChunk)
        .order('session_id', { ascending: true })
        .order('time', { ascending: true })
        .range(from, from + ELO_HISTORY_PAGE_SIZE - 1)

      if (error) {
        console.error('Failed to fetch player_stats K/D:', error.message)
        break
      }

      const page = data ?? []
      for (const row of page) {
        const key = row.name.toLowerCase()
        if (allowedPlayers && !allowedPlayers.has(key)) continue
        const existing = agg.get(key) || { kills: 0, deaths: 0 }
        existing.kills += row.kills ?? 0
        existing.deaths += row.deaths ?? 0
        agg.set(key, existing)
      }

      if (page.length < ELO_HISTORY_PAGE_SIZE) break
    }
  }

  return agg
}

/** K/D from tracker sessions for specific ranked scrims (paginated; avoids 1000-row cap). */
async function getRankedScrimKdStats(
  scrimIds: string[],
  gameNamesLower?: string[]
): Promise<Map<string, { total_kills: number; total_deaths: number; kd_ratio: number }>> {
  const result = new Map<
    string,
    { total_kills: number; total_deaths: number; kd_ratio: number }
  >()

  const sessionIds = await getTrackerSessionIdsForScrims(scrimIds)
  const allowed =
    gameNamesLower && gameNamesLower.length > 0
      ? new Set(gameNamesLower.map((n) => n.toLowerCase()))
      : null

  const agg = await aggregatePlayerStatsKd(sessionIds, allowed)

  for (const [key, { kills, deaths }] of Array.from(agg.entries())) {
    result.set(key, {
      total_kills: kills,
      total_deaths: deaths,
      kd_ratio: computeKdRatio(kills, deaths),
    })
  }

  return result
}

/** 7-day ELO change within Season 2 (only games on or after season start). */
export async function getSeason2EloChanges7Days(gameNames: string[]) {
  if (gameNames.length === 0) return []

  const supabase = await createClient()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const since = sevenDaysAgo > new Date(SEASON_2_START_ISO)
    ? sevenDaysAgo.toISOString()
    : SEASON_2_START_ISO

  const { data: historyRecords, error } = await supabase
    .from('elo_history')
    .select('game_name_lower, elo_change')
    .in('game_name_lower', gameNames)
    .gte('created_at', since)

  if (error) throw new Error(`Failed to fetch Season 2 ELO changes: ${error.message}`)
  return historyRecords || []
}

// Get ELO data for a specific player
export async function getPlayerElo(playerName: string) {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  const { data, error } = await supabase
    .from('player_elo')
    .select('*')
    .eq('game_name_lower', playerNameLower)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch player ELO: ${error.message}`)
  }

  return data
}

async function getPlayerSeasonElo(
  playerName: string,
  season: 1 | 2
): Promise<number | null> {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  let query = supabase
    .from('elo_history')
    .select('elo_change')
    .eq('game_name_lower', playerNameLower)

  query =
    season === 1
      ? query.lt('created_at', SEASON_2_START_ISO)
      : query.gte('created_at', SEASON_2_START_ISO)

  const { data, error } = await query

  if (error) {
    throw new Error(
      `Failed to fetch Season ${season} ELO: ${error.message}`
    )
  }
  if (!data?.length) return null

  const eloChangeSum = data.reduce((sum, row) => sum + (row.elo_change ?? 0), 0)
  return season1EloFromChanges(eloChangeSum)
}

/** Frozen Season 1 ELO (1200 + ranked games before Season 2). Null if no Season 1 games. */
export async function getPlayerSeason1Elo(playerName: string): Promise<number | null> {
  return getPlayerSeasonElo(playerName, 1)
}

/** Season 2 ELO (1200 + ranked games on or after Season 2 start). Null if no Season 2 games. */
export async function getPlayerSeason2Elo(playerName: string): Promise<number | null> {
  return getPlayerSeasonElo(playerName, 2)
}

/** Highest cumulative ELO ever reached (max elo_after across ranked games). */
export async function getPlayerPeakElo(playerName: string): Promise<number | null> {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  const { data: peakRow, error } = await supabase
    .from('elo_history')
    .select('elo_after')
    .eq('game_name_lower', playerNameLower)
    .order('elo_after', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch peak ELO: ${error.message}`)
  }

  if (peakRow) {
    return peakRow.elo_after
  }

  const current = await getPlayerElo(playerName)
  return current?.elo ?? null
}

/** Ranked scrims finished while at global ELO #1 (ties count). */
export async function getPlayerScrimsAtEloFirstPlace(playerName: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_scrims_at_elo_first_place', {
    p_game_name_lower: playerName.toLowerCase(),
  })

  if (error) {
    console.error('getPlayerScrimsAtEloFirstPlace:', error.message)
    return 0
  }

  return typeof data === 'number' ? data : 0
}

// ELO history row shape (no join) for player chart
export type PlayerEloHistoryRow = {
  scrim_id: string
  elo_change: number
  elo_after: number
  result: string
  created_at: string
}

// Get ELO history for a player (optionally filtered by map via scrims.map)
export async function getPlayerEloHistory(
  playerName: string,
  days = 7,
  options?: { map?: string | null }
): Promise<PlayerEloHistoryRow[]> {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)

  const mapFilter = options?.map?.trim() || null

  let scrimIds: string[] | null = null
  if (mapFilter) {
    const { data: scrimsData, error: scrimsError } = await supabase
      .from('scrims')
      .select('id')
      .eq('map', mapFilter)
      .not('finalized_at', 'is', null)
      .gte('finalized_at', daysAgo.toISOString())
    if (scrimsError) throw new Error(`Failed to fetch scrims by map: ${scrimsError.message}`)
    scrimIds = (scrimsData ?? []).map((s) => s.id)
    if (scrimIds.length === 0) return []
  }

  let query = supabase
    .from('elo_history')
    .select('scrim_id, elo_change, elo_after, result, created_at')
    .eq('game_name_lower', playerNameLower)
    .gte('created_at', daysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (scrimIds !== null) {
    query = query.in('scrim_id', scrimIds)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch player ELO history: ${error.message}`)
  return (data || []) as PlayerEloHistoryRow[]
}

// Get player rank (count of players with higher ELO)
export async function getPlayerRank(playerName: string) {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  // First get the player's ELO
  const playerElo = await getPlayerElo(playerName)
  if (!playerElo) return null

  // Count how many players have higher ELO
  const { count, error } = await supabase
    .from('player_elo')
    .select('id', { count: 'exact', head: true })
    .gt('elo', playerElo.elo)

  if (error) throw new Error(`Failed to calculate player rank: ${error.message}`)

  return {
    rank: (count || 0) + 1,
    totalPlayers: null // We can calculate this separately if needed
  }
}

// Get maps that have been played in ranked scrims (for ELO filtering)
export async function getRankedScrimMaps(options?: {
  season1?: boolean
  season2?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('scrims')
    .select('map')
    .not('map', 'is', null)
    .eq('status', 'finalized')
    .eq('is_ranked', true)

  if (options?.season1) {
    query = query.lt('finalized_at', SEASON_2_START_ISO)
  } else if (options?.season2) {
    query = query.gte('finalized_at', SEASON_2_START_ISO)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch ranked maps: ${error.message}`)

  const uniqueMaps = Array.from(new Set(data?.map((s) => s.map).filter(Boolean) as string[]))
  return uniqueMaps.sort()
}

// Get daily stats for a player (for chart)
export interface DailyStatsData {
  date: string
  kills: number
  deaths: number
}

// Alias for backward compatibility
export type DailyKillsData = DailyStatsData

export interface DailyKillsResult {
  data: DailyStatsData[]
  availableMaps: string[]
}

export async function getPlayerDailyKills(
  playerName: string,
  options: {
    days?: number | null  // null = all time
    map?: string | null
  } = {}
): Promise<DailyKillsResult> {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()
  
  // Build the query
  let query = supabase
    .from('player_stats')
    .select('time, kills, deaths, map')
    .ilike('name', playerNameLower)
  
  // Calculate start date for time filter
  const now = new Date()
  let startDate: Date | null = null
  
  if (options.days) {
    startDate = new Date()
    startDate.setDate(startDate.getDate() - options.days)
    query = query.gte('time', startDate.toISOString())
  }
  
  // Apply map filter
  if (options.map) {
    query = query.eq('map', options.map)
  }
  
  const { data, error } = await query.order('time', { ascending: true })
  
  if (error) throw new Error(`Failed to fetch daily stats: ${error.message}`)
  
  // Group by date - track both kills and deaths
  const dateMap = new Map<string, { kills: number; deaths: number }>()
  const mapsSet = new Set<string>()
  
  for (const row of data || []) {
    // Get date portion (YYYY-MM-DD)
    const dateKey = new Date(row.time).toISOString().split('T')[0]
    const existing = dateMap.get(dateKey) || { kills: 0, deaths: 0 }
    existing.kills += row.kills
    existing.deaths += row.deaths
    dateMap.set(dateKey, existing)
    if (row.map) mapsSet.add(row.map)
  }
  
  // Fill in all days in the range
  const dailyData: DailyStatsData[] = []
  
  if (options.days && startDate) {
    // Specific day range: fill from startDate to today
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)
    const endDate = new Date(now)
    endDate.setHours(0, 0, 0, 0)
    
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0]
      const stats = dateMap.get(dateKey) || { kills: 0, deaths: 0 }
      dailyData.push({
        date: dateKey,
        kills: stats.kills,
        deaths: stats.deaths
      })
      current.setDate(current.getDate() + 1)
    }
  } else {
    // "All time" - start from first data date, fill to today (cap at 30 days of fill)
    const sortedDates = Array.from(dateMap.keys()).sort()
    
    if (sortedDates.length > 0) {
      const firstDate = new Date(sortedDates[0])
      firstDate.setHours(0, 0, 0, 0)
      const endDate = new Date(now)
      endDate.setHours(0, 0, 0, 0)
      
      // Calculate total days in range
      const totalDays = Math.ceil((endDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      if (totalDays <= 30) {
        // Small range: fill all days
        const current = new Date(firstDate)
        while (current <= endDate) {
          const dateKey = current.toISOString().split('T')[0]
          const stats = dateMap.get(dateKey) || { kills: 0, deaths: 0 }
          dailyData.push({
            date: dateKey,
            kills: stats.kills,
            deaths: stats.deaths
          })
          current.setDate(current.getDate() + 1)
        }
      } else {
        // Large range: only show days with actual data (no filling)
        for (const date of sortedDates) {
          const stats = dateMap.get(date) || { kills: 0, deaths: 0 }
          dailyData.push({ date, kills: stats.kills, deaths: stats.deaths })
        }
      }
    }
  }
  
  return {
    data: dailyData,
    availableMaps: Array.from(mapsSet).sort()
  }
}

// Get player stats filtered by map (for map-specific leaderboard)
export interface MapPlayerStats {
  game_name: string
  game_name_lower: string
  wins: number
  losses: number
  draws: number
  games_played: number
  map_elo: number // Calculated as 1200 + sum of all ELO changes on this map
}

// Same derivation as getPlayerStatsByMap but for one player over time: 1200 + cumulative elo_change on that map.
// Uses the same elo_history + scrims join so "which games count for this map" is identical to the ELO page.
export type PlayerMapEloHistoryRow = { created_at: string; elo_change: number }

export async function getPlayerMapEloHistory(
  playerName: string,
  map: string,
  days: number
): Promise<PlayerMapEloHistoryRow[]> {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)

  const { data, error } = await supabase
    .from('elo_history')
    .select('created_at, elo_change, scrims!inner(map)')
    .eq('game_name_lower', playerNameLower)
    .eq('scrims.map', map)
    .gte('created_at', daysAgo.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch player map ELO history: ${error.message}`)
  return ((data || []) as { created_at: string; elo_change: number }[]).map((r) => ({
    created_at: r.created_at,
    elo_change: r.elo_change ?? 0,
  }))
}

export async function getPlayerStatsByMap(
  map: string,
  options?: { season1?: boolean; season2?: boolean }
): Promise<MapPlayerStats[]> {
  const supabase = await createClient()

  type MapHistoryRow = {
    game_name_lower: string
    result: string
    elo_change: number | null
  }

  const data: MapHistoryRow[] = []
  for (let from = 0; ; from += ELO_HISTORY_PAGE_SIZE) {
    let query = supabase
      .from('elo_history')
      .select(`
        game_name_lower,
        result,
        elo_change,
        scrims!inner(map, finalized_at)
      `)
      .eq('scrims.map', map)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ELO_HISTORY_PAGE_SIZE - 1)

    if (options?.season1) {
      query = query.lt('created_at', SEASON_2_START_ISO)
    } else if (options?.season2) {
      query = query.gte('created_at', SEASON_2_START_ISO)
    }

    const { data: page, error } = await query

    if (error) throw new Error(`Failed to fetch map stats: ${error.message}`)

    const rows = (page ?? []) as MapHistoryRow[]
    data.push(...rows)
    if (rows.length < ELO_HISTORY_PAGE_SIZE) break
  }

  // Aggregate stats per player
  const playerMap = new Map<string, { wins: number; losses: number; draws: number; eloSum: number }>()
  
  for (const record of data) {
    const existing = playerMap.get(record.game_name_lower) || { wins: 0, losses: 0, draws: 0, eloSum: 0 }
    if (record.result === 'win') existing.wins++
    else if (record.result === 'loss') existing.losses++
    else existing.draws++
    existing.eloSum += record.elo_change || 0
    playerMap.set(record.game_name_lower, existing)
  }

  // Get display names from player_elo
  const gameNames = Array.from(playerMap.keys())
  if (gameNames.length === 0) return []

  const { data: eloRecords } = await supabase
    .from('player_elo')
    .select('game_name, game_name_lower')
    .in('game_name_lower', gameNames)

  const nameMap = new Map(eloRecords?.map(r => [r.game_name_lower, r.game_name]) || [])

  // Build result array
  const results: MapPlayerStats[] = Array.from(playerMap.entries()).map(([gameNameLower, stats]) => ({
    game_name: nameMap.get(gameNameLower) || gameNameLower,
    game_name_lower: gameNameLower,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    games_played: stats.wins + stats.losses + stats.draws,
    map_elo: 1200 + stats.eloSum,
  }))

  // Sort by map_elo descending
  results.sort((a, b) => b.map_elo - a.map_elo)

  return results
}

// Get all badges earned by a player (most recent first).
export async function getPlayerBadges(playerName: string): Promise<PlayerBadge[]> {
  const supabase = await createClient()
  const trimmed = playerName.trim()
  const playerNameLower = trimmed.toLowerCase()

  const { data, error } = await supabase
    .from('player_badges')
    .select('*')
    .eq('game_name_lower', playerNameLower)
    .order('earned_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch player badges:', error.message, error.code, error.details)
    return []
  }

  if (data && data.length > 0) {
    return data as PlayerBadge[]
  }

  // Fallback: match display name (handles game_name_lower typos or legacy rows)
  const { data: byDisplayName, error: nameError } = await supabase
    .from('player_badges')
    .select('*')
    .ilike('game_name', trimmed)
    .order('earned_at', { ascending: false })

  if (nameError) {
    console.error('Failed to fetch player badges by game_name:', nameError.message)
    return []
  }

  return (byDisplayName || []) as PlayerBadge[]
}

const BADGE_AWARD_PAGE_SIZE = 1000

type BadgeAwardRow = Pick<
  PlayerBadge,
  'badge_type' | 'game_name' | 'game_name_lower' | 'earned_at'
>

async function fetchAllBadgeAwardRows(): Promise<BadgeAwardRow[]> {
  const supabase = await createClient()
  const rows: BadgeAwardRow[] = []

  for (let from = 0; ; from += BADGE_AWARD_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('player_badges')
      .select('badge_type, game_name, game_name_lower, earned_at')
      .order('earned_at', { ascending: false })
      .range(from, from + BADGE_AWARD_PAGE_SIZE - 1)

    if (error) {
      console.error('Failed to fetch badge catalog rows:', error.message)
      break
    }

    const page = (data ?? []) as BadgeAwardRow[]
    rows.push(...page)
    if (page.length < BADGE_AWARD_PAGE_SIZE) break
  }

  return rows
}

function aggregateBadgeHolders(rows: BadgeAwardRow[]): Map<string, BadgeHolderSummary[]> {
  const byType = new Map<string, Map<string, BadgeHolderSummary>>()

  for (const row of rows) {
    let players = byType.get(row.badge_type)
    if (!players) {
      players = new Map()
      byType.set(row.badge_type, players)
    }

    const existing = players.get(row.game_name_lower)
    if (existing) {
      existing.count += 1
      if (row.earned_at < existing.firstEarnedAt) {
        existing.firstEarnedAt = row.earned_at
      }
      if (row.earned_at > existing.lastEarnedAt) {
        existing.lastEarnedAt = row.earned_at
      }
      existing.game_name = row.game_name
    } else {
      players.set(row.game_name_lower, {
        game_name: row.game_name,
        game_name_lower: row.game_name_lower,
        count: 1,
        firstEarnedAt: row.earned_at,
        lastEarnedAt: row.earned_at,
      })
    }
  }

  const result = new Map<string, BadgeHolderSummary[]>()
  for (const [badgeType, players] of Array.from(byType.entries())) {
    result.set(badgeType, [...Array.from(players.values())])
  }
  return result
}

/** Full badge catalog with holder lists for the badges page. */
export async function getBadgeCatalog(): Promise<BadgeCatalogEntry[]> {
  const rows = await fetchAllBadgeAwardRows()
  const holdersByType = aggregateBadgeHolders(rows)

  return orderedCatalogBadgeTypes().map((badgeType) =>
    buildBadgeCatalogEntry(badgeType, holdersByType.get(badgeType) ?? [])
  )
}

export interface RankedPlayerOption {
  game_name: string
  game_name_lower: string
  games_played: number
}

/** Players with at least one ranked (ELO) game — for teammate stats picker. */
export async function searchRankedPlayers(
  query: string,
  limit = 12
): Promise<RankedPlayerOption[]> {
  if (!query.trim()) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('player_elo')
    .select('game_name, game_name_lower, games_played')
    .ilike('game_name_lower', `%${query.toLowerCase().trim()}%`)
    .gt('games_played', 0)
    .order('games_played', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to search ranked players:', error.message)
    return []
  }

  return data ?? []
}

/** Resolve typed name to a ranked player (exact lower name, then display name). */
export async function resolveRankedPlayer(
  query: string
): Promise<RankedPlayerOption | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const supabase = await createClient()
  const lower = trimmed.toLowerCase()

  const { data: exact } = await supabase
    .from('player_elo')
    .select('game_name, game_name_lower, games_played')
    .eq('game_name_lower', lower)
    .gt('games_played', 0)
    .maybeSingle()

  if (exact) return exact

  const { data: byDisplay } = await supabase
    .from('player_elo')
    .select('game_name, game_name_lower, games_played')
    .ilike('game_name', trimmed)
    .gt('games_played', 0)
    .order('games_played', { ascending: false })
    .limit(1)
    .maybeSingle()

  return byDisplay ?? null
}

export async function getRankedPlayerOptions(limit = 200): Promise<RankedPlayerOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('player_elo')
    .select('game_name, game_name_lower, games_played')
    .gt('games_played', 0)
    .order('games_played', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch ranked players: ${error.message}`)
  return data ?? []
}

function parseRankedGameRow(row: {
  game_name_lower: string
  result: string
  scrim_id: string
  team_score: number | null
  opponent_score: number | null
  kills: number | null
  scrims: { map?: string | null } | { map?: string | null }[] | null
}): RankedGame | null {
  if (row.result !== 'win' && row.result !== 'loss' && row.result !== 'draw') {
    return null
  }
  const scrimRaw = row.scrims
  const scrim = Array.isArray(scrimRaw) ? scrimRaw[0] : scrimRaw
  return {
    gameNameLower: row.game_name_lower,
    scrimId: row.scrim_id,
    result: row.result,
    roundsFor: row.team_score ?? 0,
    roundsAgainst: row.opponent_score ?? 0,
    kills: row.kills ?? 0,
    map: scrim?.map ?? null,
  }
}

/** Paginated elo_history fetch (Supabase caps at 1000 rows per request). */
async function fetchRankedGames(
  season2: boolean,
  playerNamesLower: string[]
): Promise<RankedGame[]> {
  const supabase = await createClient()
  const pageSize = 1000
  const games: RankedGame[] = []
  const uniqueNames = Array.from(
    new Set(playerNamesLower.map((n) => n.toLowerCase().trim()).filter(Boolean))
  )

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('elo_history')
      .select(`
        game_name_lower,
        result,
        scrim_id,
        team_score,
        opponent_score,
        kills,
        scrims!inner(status, finalized_at, map)
      `)
      .eq('scrims.status', 'finalized')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (uniqueNames.length > 0) {
      query = query.in('game_name_lower', uniqueNames)
    }

    if (season2) {
      query = query.gte('scrims.finalized_at', SEASON_2_START_ISO)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch ranked games: ${error.message}`)

    const page = data ?? []
    for (const row of page) {
      const game = parseRankedGameRow(row)
      if (game) games.push(game)
    }

    if (page.length < pageSize) break
  }

  return games
}

/** All ranked players on specific scrims (for everyone-but / all-teammates modes). */
async function fetchRankedGamesForScrims(
  season2: boolean,
  scrimIds: string[]
): Promise<RankedGame[]> {
  if (scrimIds.length === 0) return []

  const supabase = await createClient()
  const pageSize = 1000
  const games: RankedGame[] = []
  const scrimChunkSize = 80

  for (let i = 0; i < scrimIds.length; i += scrimChunkSize) {
    const scrimChunk = scrimIds.slice(i, i + scrimChunkSize)

    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from('elo_history')
        .select(`
          game_name_lower,
          result,
          scrim_id,
          team_score,
          opponent_score,
          kills,
          scrims!inner(status, finalized_at, map)
        `)
        .eq('scrims.status', 'finalized')
        .in('scrim_id', scrimChunk)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)

      if (season2) {
        query = query.gte('scrims.finalized_at', SEASON_2_START_ISO)
      }

      const { data, error } = await query
      if (error) {
        throw new Error(`Failed to fetch ranked games for scrims: ${error.message}`)
      }

      const page = data ?? []
      for (const row of page) {
        const game = parseRankedGameRow(row)
        if (game) games.push(game)
      }

      if (page.length < pageSize) break
    }
  }

  return games
}

export async function getTeammateStats(
  comparisons: TeammateComparisonInput[],
  options?: { season2?: boolean }
): Promise<TeammateStatsResult[]> {
  const normalized = comparisons
    .map((c) => ({
      subject: c.subject.trim().toLowerCase(),
      teammate: c.teammate.trim().toLowerCase(),
      mode: c.mode,
      map: c.map?.trim() || undefined,
    }))
    .filter(
      (c) =>
        c.subject && (c.mode === 'all_teammates' || c.teammate)
    )

  if (normalized.length === 0) return []

  const playerNames = Array.from(
    new Set(
      normalized.flatMap((c) =>
        c.mode === 'all_teammates' ? [c.subject] : [c.subject, c.teammate]
      )
    )
  )

  const season2 = options?.season2 === true
  let games = await fetchRankedGames(season2, playerNames)

  if (normalized.some((c) => comparisonNeedsFullScrimRoster(c.mode))) {
    const subjects = new Set(normalized.map((c) => c.subject))
    const scrimIds = Array.from(
      new Set(
        games
          .filter((g) => subjects.has(g.gameNameLower))
          .map((g) => g.scrimId)
      )
    )
    const scrimGames = await fetchRankedGamesForScrims(season2, scrimIds)
    games = mergeRankedGames(games, scrimGames)
  }

  const rankedPlayers = await getRankedPlayerOptions(500)
  const displayNames = new Map(
    rankedPlayers.map((p) => [p.game_name_lower, p.game_name])
  )

  return computeTeammateStats(games, displayNames, normalized)
}
