'use server'

import { createClient } from '@/lib/supabase/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { CreateScrimInput, Scrim, ScrimPlayer, ScrimWithCounts, ScrimScoreSubmission } from '@/lib/supabase/types'

// Get current user info from Clerk
async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')
  
  const user = await currentUser()
  const userName = user?.username || user?.firstName || 'Anonymous'
  
  return { userId, userName }
}

// Create a new scrim
export async function createScrim(input?: CreateScrimInput): Promise<Scrim> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrims')
    .insert({
      created_by: userId,
      created_by_name: userName,
      title: input?.title || null,
      map: input?.map || null,
      max_players_per_team: input?.max_players_per_team || 8,
      min_players_per_team: input?.min_players_per_team || 1,
    })
    .select()
    .single()
  
  if (error) throw new Error(`Failed to create scrim: ${error.message}`)
  
  // Auto-join the creator
  await joinScrim(data.id)
  
  revalidatePath('/scrim')
  return data
}

// Get all active scrims (waiting or in progress)
export async function getActiveScrims(): Promise<ScrimWithCounts[]> {
  const supabase = await createClient()
  
  // First, expire any stale scrims
  await supabase.rpc('expire_stale_scrims')
  
  const { data, error } = await supabase
    .from('scrims_with_counts')
    .select('*')
    .in('status', ['waiting', 'ready_check', 'in_progress', 'scoring'])
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(`Failed to fetch scrims: ${error.message}`)
  return data || []
}

// Get a single scrim by ID
export async function getScrim(scrimId: string): Promise<ScrimWithCounts | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrims_with_counts')
    .select('*')
    .eq('id', scrimId)
    .single()
  
  if (error) return null
  return data
}

// Get players for a scrim
export async function getScrimPlayers(scrimId: string): Promise<ScrimPlayer[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrim_players')
    .select('*')
    .eq('scrim_id', scrimId)
    .order('joined_at', { ascending: true })
  
  if (error) throw new Error(`Failed to fetch players: ${error.message}`)
  return data || []
}

// Join a scrim
export async function joinScrim(scrimId: string): Promise<ScrimPlayer> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()
  
  // Check if scrim is still in waiting status
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  if (scrim.status !== 'waiting') throw new Error('Cannot join: scrim is no longer in waiting phase')
  
  // Check if already at max capacity
  if (scrim.player_count >= scrim.max_players_per_team * 2) {
    throw new Error('Scrim is full')
  }
  
  const { data, error } = await supabase
    .from('scrim_players')
    .upsert({
      scrim_id: scrimId,
      user_id: userId,
      user_name: userName,
    }, {
      onConflict: 'scrim_id,user_id'
    })
    .select()
    .single()
  
  if (error) throw new Error(`Failed to join scrim: ${error.message}`)
  
  revalidatePath('/scrim')
  return data
}

// Leave a scrim
export async function leaveScrim(scrimId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('scrim_players')
    .delete()
    .eq('scrim_id', scrimId)
    .eq('user_id', userId)
  
  if (error) throw new Error(`Failed to leave scrim: ${error.message}`)
  
  revalidatePath('/scrim')
}

// Toggle ready status
export async function toggleReady(scrimId: string): Promise<ScrimPlayer> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  // Get current ready status
  const { data: current } = await supabase
    .from('scrim_players')
    .select('is_ready')
    .eq('scrim_id', scrimId)
    .eq('user_id', userId)
    .single()
  
  const newReadyStatus = !current?.is_ready
  
  const { data, error } = await supabase
    .from('scrim_players')
    .update({
      is_ready: newReadyStatus,
      ready_at: newReadyStatus ? new Date().toISOString() : null,
    })
    .eq('scrim_id', scrimId)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) throw new Error(`Failed to toggle ready: ${error.message}`)
  
  // Check if everyone is ready and we have even teams
  await checkAndStartGame(scrimId)
  
  revalidatePath('/scrim')
  return data
}

// Check if all players are ready and start the game
async function checkAndStartGame(scrimId: string): Promise<void> {
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim || scrim.status !== 'waiting') return
  
  const players = await getScrimPlayers(scrimId)
  const readyCount = players.filter(p => p.is_ready).length
  const totalCount = players.length
  
  // Need at least min_players_per_team * 2, all ready, and even count
  if (
    totalCount >= scrim.min_players_per_team * 2 &&
    readyCount === totalCount &&
    totalCount % 2 === 0
  ) {
    // All conditions met - assign teams and start!
    await supabase.rpc('assign_random_teams', { p_scrim_id: scrimId })
  }
}

// End the game and move to scoring phase
export async function endGame(scrimId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  if (scrim.status !== 'in_progress') throw new Error('Game is not in progress')
  
  // Only creator or participants can end the game
  const players = await getScrimPlayers(scrimId)
  const isParticipant = players.some(p => p.user_id === userId)
  if (scrim.created_by !== userId && !isParticipant) {
    throw new Error('Not authorized to end this game')
  }
  
  const { error } = await supabase
    .from('scrims')
    .update({
      status: 'scoring',
      finished_at: new Date().toISOString(),
    })
    .eq('id', scrimId)
  
  if (error) throw new Error(`Failed to end game: ${error.message}`)
  
  revalidatePath('/scrim')
}

// Submit a score
export async function submitScore(
  scrimId: string,
  teamAScore: number,
  teamBScore: number
): Promise<void> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  if (scrim.status !== 'scoring') throw new Error('Scrim is not in scoring phase')
  
  // Verify user was a participant
  const players = await getScrimPlayers(scrimId)
  const isParticipant = players.some(p => p.user_id === userId)
  if (!isParticipant) throw new Error('Only participants can submit scores')
  
  const { error } = await supabase
    .from('scrim_score_submissions')
    .upsert({
      scrim_id: scrimId,
      user_id: userId,
      user_name: userName,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
    }, {
      onConflict: 'scrim_id,user_id'
    })
  
  if (error) throw new Error(`Failed to submit score: ${error.message}`)
  
  // Try to finalize if consensus reached
  await supabase.rpc('finalize_scrim', { p_scrim_id: scrimId })
  
  revalidatePath('/scrim')
}

// Get score submissions for a scrim
export async function getScoreSubmissions(scrimId: string): Promise<ScrimScoreSubmission[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrim_score_submissions')
    .select('*')
    .eq('scrim_id', scrimId)
  
  if (error) throw new Error(`Failed to fetch scores: ${error.message}`)
  return data || []
}

// Cancel a scrim (creator only)
export async function cancelScrim(scrimId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  if (scrim.created_by !== userId) throw new Error('Only the creator can cancel')
  if (!['waiting', 'ready_check'].includes(scrim.status)) {
    throw new Error('Cannot cancel a scrim that has already started')
  }
  
  const { error } = await supabase
    .from('scrims')
    .update({ status: 'cancelled' })
    .eq('id', scrimId)
  
  if (error) throw new Error(`Failed to cancel scrim: ${error.message}`)
  
  revalidatePath('/scrim')
}

// Set tracker session ID for a scrim (participants only, during scoring or after)
export async function setTrackerSessionId(scrimId: string, sessionId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  
  // Only allow setting during scoring or after finalized
  if (!['scoring', 'finalized'].includes(scrim.status)) {
    throw new Error('Can only set tracker link during or after scoring')
  }
  
  // Verify user was a participant
  const players = await getScrimPlayers(scrimId)
  const isParticipant = players.some(p => p.user_id === userId)
  if (!isParticipant && scrim.created_by !== userId) {
    throw new Error('Only participants can set the tracker link')
  }
  
  const { data, error } = await supabase
    .from('scrims')
    .update({ tracker_session_id: sessionId })
    .eq('id', scrimId)
    .select()
    .single()
  
  if (error) {
    console.error('Supabase update error:', error)
    throw new Error(`Failed to set tracker link: ${error.message}`)
  }
  
  console.log('Updated scrim:', data)
  
  revalidatePath('/scrim')
  revalidatePath(`/scrim/${scrimId}`)
}

// Session stats types for tracker data
export interface SessionPlayer {
  name: string
  kills: number
  deaths: number
  player_honor?: number
}

export interface SessionStats {
  session_id: string
  map?: string
  duration?: number
  peak_players?: number
  players: SessionPlayer[]
  total_kills: number
  total_deaths: number
}

const TRACKER_API = "https://server-details.ej.workers.dev"

// Fetch session stats from tracker API
export async function getSessionStats(sessionIds: string): Promise<SessionStats[]> {
  // Parse session IDs (supports + delimited)
  const ids = sessionIds.split(/[+~\s]+/).filter(id => id.trim())
  
  const results: SessionStats[] = []
  
  for (const id of ids.slice(0, 8)) { // Max 8 sessions
    try {
      // Fetch session info and players in parallel
      const [sessionRes, playersRes, analyticsRes] = await Promise.all([
        fetch(`${TRACKER_API}/sessions/${encodeURIComponent(id)}`),
        fetch(`${TRACKER_API}/sessions/${encodeURIComponent(id)}/players`),
        fetch(`${TRACKER_API}/analytics/sessions/${encodeURIComponent(id)}`),
      ])
      
      const sessionData = sessionRes.ok ? await sessionRes.json() : null
      const playersData = playersRes.ok ? await playersRes.json() : []
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : {}
      
      const players: SessionPlayer[] = Array.isArray(playersData) 
        ? playersData 
        : (playersData.players || [])
      
      results.push({
        session_id: id,
        map: sessionData?.map,
        duration: sessionData?.duration,
        peak_players: sessionData?.peak_players,
        players,
        total_kills: analyticsData.total_kills || players.reduce((sum, p) => sum + p.kills, 0),
        total_deaths: analyticsData.total_deaths || players.reduce((sum, p) => sum + p.deaths, 0),
      })
    } catch (err) {
      console.error(`Failed to fetch session ${id}:`, err)
    }
  }
  
  return results
}

// Get distinct maps from player_stats (tracker data)
export async function getTrackerMaps(): Promise<string[]> {
  const supabase = await createClient()
  
  // Use RPC function for efficient distinct query
  const { data, error } = await supabase.rpc('get_distinct_maps')
  
  if (error) {
    console.error('Failed to fetch maps:', error)
    return []
  }
  
  return data?.map((row: { map: string }) => row.map) || []
}

// Get recent finished scrims
export async function getRecentScrims(limit = 10): Promise<ScrimWithCounts[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrims_with_counts')
    .select('*')
    .in('status', ['finalized', 'cancelled', 'expired'])
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(`Failed to fetch recent scrims: ${error.message}`)
  return data || []
}

// Check if current user is in a scrim
export async function getCurrentUserScrimStatus(scrimId: string): Promise<{
  isParticipant: boolean
  isCreator: boolean
  player: ScrimPlayer | null
}> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  const scrim = await getScrim(scrimId)
  if (!scrim) return { isParticipant: false, isCreator: false, player: null }
  
  const { data: player } = await supabase
    .from('scrim_players')
    .select('*')
    .eq('scrim_id', scrimId)
    .eq('user_id', userId)
    .single()
  
  return {
    isParticipant: !!player,
    isCreator: scrim.created_by === userId,
    player: player || null,
  }
}

