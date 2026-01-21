'use server'

import { createClient } from '@/lib/supabase/server'

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

  // Search in player_stats, aggregate by name, filter by substring match
  // Using a raw query approach with ilike for substring matching
  const { data, error } = await supabase
    .from('player_stats')
    .select('name, kills, deaths')
    .ilike('name', `%${searchTerm}%`)
    .order('kills', { ascending: false })
    .limit(500) // Get enough records to aggregate

  if (error) {
    console.error('Failed to search players:', error)
    return []
  }

  // Aggregate by player name (case-insensitive)
  const playerMap = new Map<string, { displayName: string; kills: number; deaths: number }>()
  
  for (const row of data || []) {
    const lowerName = row.name.toLowerCase()
    const existing = playerMap.get(lowerName)
    if (existing) {
      existing.kills += row.kills
      existing.deaths += row.deaths
      // Keep the most common casing (first seen)
    } else {
      playerMap.set(lowerName, {
        displayName: row.name,
        kills: row.kills,
        deaths: row.deaths,
      })
    }
  }

  // Convert to array and sort by total kills
  const results = Array.from(playerMap.values())
    .map((p) => ({
      name: p.displayName,
      total_kills: p.kills,
      total_deaths: p.deaths,
    }))
    .sort((a, b) => b.total_kills - a.total_kills)
    .slice(0, limit)

  return results
}

// Get ELO leaderboard with top players
export async function getEloLeaderboard(limit = 100) {
  const supabase = await createClient()

  const { data: eloRecords, error } = await supabase
    .from('player_elo')
    .select('*')
    .order('elo', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch ELO leaderboard: ${error.message}`)
  return eloRecords || []
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

// Get ELO history for a player
export async function getPlayerEloHistory(playerName: string, days = 7) {
  const supabase = await createClient()
  const playerNameLower = playerName.toLowerCase()

  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)

  const { data, error } = await supabase
    .from('elo_history')
    .select(`
      scrim_id,
      elo_change,
      elo_after,
      result,
      created_at
    `)
    .eq('game_name_lower', playerNameLower)
    .gte('created_at', daysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch player ELO history: ${error.message}`)
  return data || []
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
export async function getRankedScrimMaps() {
  const supabase = await createClient()

  // Get distinct maps from scrims that have ELO history
  const { data, error } = await supabase
    .from('scrims')
    .select('map')
    .not('map', 'is', null)
    .eq('status', 'finalized')
    .eq('is_ranked', true)

  if (error) throw new Error(`Failed to fetch ranked maps: ${error.message}`)

  // Get unique maps
  const uniqueMaps = Array.from(new Set(data?.map(s => s.map).filter(Boolean) as string[]))
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

export async function getPlayerStatsByMap(map: string): Promise<MapPlayerStats[]> {
  const supabase = await createClient()

  // Join elo_history with scrims to filter by map, include elo_change
  const { data, error } = await supabase
    .from('elo_history')
    .select(`
      game_name_lower,
      result,
      elo_change,
      scrims!inner(map)
    `)
    .eq('scrims.map', map)

  if (error) throw new Error(`Failed to fetch map stats: ${error.message}`)

  // Aggregate stats per player
  const playerMap = new Map<string, { wins: number; losses: number; draws: number; eloSum: number }>()
  
  for (const record of data || []) {
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
