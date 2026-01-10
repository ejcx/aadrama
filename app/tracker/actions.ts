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
