'use server'

import { createClient } from '@/lib/supabase/server'

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
  const uniqueMaps = [...new Set(data?.map(s => s.map).filter(Boolean) as string[])]
  return uniqueMaps.sort()
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
