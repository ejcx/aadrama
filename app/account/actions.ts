'use server'

import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { UserGameName, CreateGameNameInput, PlayerElo, EloHistory } from '@/lib/supabase/types'

// Get current user ID from Clerk
async function getCurrentUserId() {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')
  return userId
}

// Get all game names for the current user
export async function getMyGameNames(): Promise<UserGameName[]> {
  const userId = await getCurrentUserId()
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_game_names')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(`Failed to fetch game names: ${error.message}`)
  return data || []
}

// Add a new game name
export async function addGameName(input: CreateGameNameInput): Promise<UserGameName> {
  const userId = await getCurrentUserId()
  const supabase = await createClient()
  
  const gameName = input.game_name.trim()
  if (!gameName) throw new Error('Game name cannot be empty')
  if (gameName.length > 50) throw new Error('Game name is too long')
  
  const gameNameLower = gameName.toLowerCase()
  
  const { data, error } = await supabase
    .from('user_game_names')
    .insert({
      user_id: userId,
      game_name: gameName,
      game_name_lower: gameNameLower,
    })
    .select()
    .single()
  
  if (error) {
    if (error.code === '23505') {
      throw new Error('This name has already been claimed')
    }
    throw new Error(`Failed to add game name: ${error.message}`)
  }
  
  revalidatePath('/account/game-names')
  return data
}

// Delete a game name (user can only delete their own)
export async function deleteGameName(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('user_game_names')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  
  if (error) throw new Error(`Failed to delete: ${error.message}`)
  
  revalidatePath('/account/game-names')
}

// Get ELO for a specific game name
export async function getPlayerElo(gameName: string): Promise<PlayerElo | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('player_elo')
    .select('*')
    .eq('game_name_lower', gameName.toLowerCase())
    .single()
  
  if (error) return null
  return data
}

// Get ELO history for a specific game name
export async function getPlayerEloHistory(gameName: string, limit = 20): Promise<EloHistory[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('elo_history')
    .select('*')
    .eq('game_name_lower', gameName.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(`Failed to fetch ELO history: ${error.message}`)
  return data || []
}

// Get ELO for all of the current user's game names
export async function getMyEloStats(): Promise<Array<UserGameName & { elo: PlayerElo | null; recent_history: EloHistory[] }>> {
  const userId = await getCurrentUserId()
  const supabase = await createClient()
  
  // Get all user's game names
  const { data: gameNames, error: namesError } = await supabase
    .from('user_game_names')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (namesError) throw new Error(`Failed to fetch game names: ${namesError.message}`)
  if (!gameNames || gameNames.length === 0) return []
  
  // Get ELO for each game name
  const results = await Promise.all(
    gameNames.map(async (gn) => {
      const { data: elo } = await supabase
        .from('player_elo')
        .select('*')
        .eq('game_name_lower', gn.game_name_lower)
        .single()
      
      const { data: history } = await supabase
        .from('elo_history')
        .select('*')
        .eq('game_name_lower', gn.game_name_lower)
        .order('created_at', { ascending: false })
        .limit(5)
      
      return {
        ...gn,
        elo: elo || null,
        recent_history: history || [],
      }
    })
  )
  
  return results
}
