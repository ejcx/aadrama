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
      is_ranked: input?.is_ranked !== false, // Default to ranked
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

  console.log(`[Scrim ${scrimId}] checkAndStartGame called, status: ${scrim?.status}`)

  if (!scrim) {
    console.log(`[Scrim ${scrimId}] Scrim not found`)
    return
  }

  if (scrim.status !== 'waiting') {
    console.log(`[Scrim ${scrimId}] Status is '${scrim.status}', not 'waiting' - skipping`)
    return
  }
  
  const players = await getScrimPlayers(scrimId)
  const readyCount = players.filter(p => p.is_ready).length
  const totalCount = players.length
  const minRequired = scrim.min_players_per_team * 2

  console.log(`[Scrim ${scrimId}] Players: ${totalCount}, Ready: ${readyCount}, Min required: ${minRequired}, Even: ${totalCount % 2 === 0}`)
  
  // Need at least min_players_per_team * 2, all ready, and even count
  if (totalCount < minRequired) {
    console.log(`[Scrim ${scrimId}] Not enough players (${totalCount} < ${minRequired})`)
    return
  }

  if (readyCount !== totalCount) {
    console.log(`[Scrim ${scrimId}] Not all players ready (${readyCount}/${totalCount})`)
    return
  }

  if (totalCount % 2 !== 0) {
    console.log(`[Scrim ${scrimId}] Odd number of players (${totalCount})`)
    return
  }

  // All conditions met - assign teams and start!
  console.log(`[Scrim ${scrimId}] All conditions met! Calling assign_random_teams...`)
  const { error } = await supabase.rpc('assign_random_teams', { p_scrim_id: scrimId })

  if (error) {
    console.error(`[Scrim ${scrimId}] assign_random_teams failed:`, error)
    throw new Error(`Failed to start game: ${error.message}`)
  }

  console.log(`[Scrim ${scrimId}] Teams assigned successfully! Game started.`)
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
  
  // Check if scrim was finalized and process ELO automatically
  const updatedScrim = await getScrim(scrimId)
  if (updatedScrim?.status === 'finalized' && updatedScrim.is_ranked && 
      updatedScrim.tracker_session_id && !updatedScrim.ranked_processed_at) {
    try {
      const eloResult = await processRankedScrim(scrimId)
      if (eloResult.success) {
        console.log(`ELO processed for ${eloResult.eloChanges?.length || 0} players after finalization`)
      }
    } catch (eloError) {
      console.error('ELO processing error after finalization:', eloError)
    }
  }
  
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

// Helper function to extract session ID from input
// Handles full aadrama URLs and extracts/decodes the session ID
function extractSessionId(input: string): string {
  const trimmed = input.trim()
  
  // Check if it's a full aadrama URL
  const aadramaPatterns = [
    /https?:\/\/(?:www\.)?aadrama\.com\/tracker\/session\/(.+)/i,
    /aadrama\.com\/tracker\/session\/(.+)/i,
  ]
  
  for (const pattern of aadramaPatterns) {
    const match = trimmed.match(pattern)
    if (match && match[1]) {
      // Extract the session ID part and decode URL encoding
      const sessionPart = match[1]
      // Remove any trailing slashes or query params
      const cleanSession = sessionPart.split('?')[0].replace(/\/+$/, '')
      // Decode URL encoding (e.g., %3A -> :)
      return decodeURIComponent(cleanSession)
    }
  }
  
  // Not an aadrama URL, return as-is (but decode if it looks URL-encoded)
  if (trimmed.includes('%')) {
    try {
      return decodeURIComponent(trimmed)
    } catch {
      // If decoding fails, return as-is
      return trimmed
    }
  }
  
  return trimmed
}

// Set tracker session ID for a scrim (participants only, during scoring or after)
export async function setTrackerSessionId(scrimId: string, sessionIdInput: string): Promise<void> {
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
  
  // Extract and clean the session ID
  const sessionId = extractSessionId(sessionIdInput)
  
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
  
  // Automatically process ELO for ranked scrims when session ID is added
  if (data.is_ranked && data.status === 'finalized' && !data.ranked_processed_at) {
    try {
      // First log the validation state for debugging
      const debugInfo = await debugEloValidation(scrimId)
      console.log('=== ELO Debug Info ===')
      console.log('Scrim:', debugInfo.scrim)
      console.log('Session players from tracker:', debugInfo.sessionPlayers)
      console.log('Validation errors:', debugInfo.validation?.errors)
      console.log('Player matches:')
      for (const pm of debugInfo.validation?.playerMatches || []) {
        console.log(`  - ${pm.userName} (user_id: ${pm.userId.slice(0, 8)}...)`)
        console.log(`    Linked game name: ${pm.gameNameLower || 'NONE'}`)
        console.log(`    Matched to session player: ${pm.sessionPlayerName || 'NO MATCH'}`)
        console.log(`    Matched: ${pm.matched}`)
      }
      console.log('======================')
      
      const eloResult = await processRankedScrim(scrimId)
      if (eloResult.success) {
        console.log(`ELO processed for ${eloResult.eloChanges?.length || 0} players`)
      } else {
        console.log('ELO processing skipped:', eloResult.error)
      }
    } catch (eloError) {
      // Don't fail the whole operation if ELO processing fails
      console.error('ELO processing error:', eloError)
    }
  }
  
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
  // Decode URL encoding first (handles %3A -> : etc)
  const decoded = decodeURIComponent(sessionIds)
  
  // Parse session IDs (supports + delimited)
  const ids = decoded.split(/[+~\s]+/).filter(id => id.trim())
  
  const results: SessionStats[] = []
  
  for (const id of ids.slice(0, 8)) { // Max 8 sessions
    try {
      // Fetch session info and players in parallel
      // Note: id is now decoded, so we need to encode it for the URL
      const [sessionRes, playersRes, analyticsRes] = await Promise.all([
        fetch(`${TRACKER_API}/sessions/${encodeURIComponent(id)}`),
        fetch(`${TRACKER_API}/sessions/${encodeURIComponent(id)}/players`),
        fetch(`${TRACKER_API}/analytics/sessions/${encodeURIComponent(id)}`),
      ])
      
      const sessionData = sessionRes.ok ? await sessionRes.json() : null
      const playersData = playersRes.ok ? await playersRes.json() : null
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : {}
      
      // Handle various response formats - could be array, object with players, or null
      let players: SessionPlayer[] = []
      if (Array.isArray(playersData)) {
        players = playersData
      } else if (playersData && typeof playersData === 'object' && Array.isArray(playersData.players)) {
        players = playersData.players
      }
      
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

// Get recent finished scrims with optional date and map filtering
export async function getRecentScrims(options?: {
  limit?: number
  startTime?: string
  endTime?: string
  map?: string
}): Promise<ScrimWithCounts[]> {
  const supabase = await createClient()
  const limit = options?.limit || 10
  
  let query = supabase
    .from('scrims_with_counts')
    .select('*')
    .eq('status', 'finalized')
    .gte('player_count', 8) // Only 4v4+ games
  
  // Apply date filters if provided
  if (options?.startTime) {
    query = query.gte('created_at', options.startTime)
  }
  if (options?.endTime) {
    query = query.lte('created_at', options.endTime)
  }
  
  // Apply map filter if provided
  if (options?.map) {
    query = query.eq('map', options.map)
  }
  
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(`Failed to fetch recent scrims: ${error.message}`)
  return data || []
}

// Get unique maps from scrims (for filtering)
export async function getScrimMaps(): Promise<string[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('scrims')
    .select('map')
    .not('map', 'is', null)
    .eq('status', 'finalized')
  
  if (error) {
    console.error('Failed to fetch scrim maps:', error)
    return []
  }
  
  // Get unique maps
  const uniqueMaps = Array.from(new Set(data?.map(s => s.map).filter(Boolean) as string[]))
  return uniqueMaps.sort()
}

// Get scrims for a specific player (by game name)
export interface PlayerScrimResult {
  id: string
  map: string | null
  team_a_score: number | null
  team_b_score: number | null
  created_at: string
  finished_at: string | null
  player_team: 'team_a' | 'team_b' | null
  result: 'win' | 'loss' | 'draw' | null
  elo_change: number | null
  tracker_session_id: string | null
}

export async function getPlayerScrims(options: {
  gameName: string
  limit?: number
  startTime?: string
  endTime?: string
  map?: string
}): Promise<PlayerScrimResult[]> {
  const supabase = await createClient()
  const gameNameLower = options.gameName.toLowerCase()
  
  // Get ELO history for this player to find their scrims
  let query = supabase
    .from('elo_history')
    .select(`
      scrim_id,
      result,
      elo_change,
      created_at,
      scrims!inner(
        id,
        map,
        team_a_score,
        team_b_score,
        created_at,
        finished_at,
        tracker_session_id
      )
    `)
    .eq('game_name_lower', gameNameLower)
    .order('created_at', { ascending: false })
  
  // Apply date filters
  if (options.startTime) {
    query = query.gte('created_at', options.startTime)
  }
  if (options.endTime) {
    query = query.lte('created_at', options.endTime)
  }
  
  // Apply map filter
  if (options.map) {
    query = query.eq('scrims.map', options.map)
  }
  
  // Apply limit
  query = query.limit(options.limit || 25)
  
  const { data, error } = await query
  
  if (error) {
    console.error('Failed to fetch player scrims:', error)
    return []
  }
  
  // Transform the data
  return (data || []).map(record => {
    const scrim = record.scrims as unknown as {
      id: string
      map: string | null
      team_a_score: number | null
      team_b_score: number | null
      created_at: string
      finished_at: string | null
      tracker_session_id: string | null
    }
    
    // Determine player's team based on result and scores
    let playerTeam: 'team_a' | 'team_b' | null = null
    if (scrim.team_a_score !== null && scrim.team_b_score !== null) {
      if (record.result === 'win') {
        playerTeam = scrim.team_a_score > scrim.team_b_score ? 'team_a' : 'team_b'
      } else if (record.result === 'loss') {
        playerTeam = scrim.team_a_score < scrim.team_b_score ? 'team_a' : 'team_b'
      } else {
        playerTeam = 'team_a' // Draw, doesn't matter
      }
    }
    
    return {
      id: scrim.id,
      map: scrim.map,
      team_a_score: scrim.team_a_score,
      team_b_score: scrim.team_b_score,
      created_at: scrim.created_at,
      finished_at: scrim.finished_at,
      player_team: playerTeam,
      result: record.result as 'win' | 'loss' | 'draw' | null,
      elo_change: record.elo_change,
      tracker_session_id: scrim.tracker_session_id,
    }
  })
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

// ==================== REROLL TEAMS ====================

export interface RerollStatus {
  totalPlayers: number
  votesForReroll: number
  votesNeeded: number
  canReroll: boolean
  voters: string[] // user names of those who voted
  myVote: boolean
}

// Get reroll status for a scrim
export async function getRerollStatus(scrimId: string): Promise<RerollStatus> {
  const supabase = await createClient()
  
  // Get reroll status from database function
  const { data: status, error: statusError } = await supabase.rpc('get_reroll_status', { p_scrim_id: scrimId })
  
  if (statusError) {
    console.error('Failed to get reroll status:', statusError)
    throw new Error(`Failed to get reroll status: ${statusError.message}`)
  }
  
  // Get players who voted for reroll
  const { data: players, error: playersError } = await supabase
    .from('scrim_players')
    .select('user_id, user_name, voted_reroll')
    .eq('scrim_id', scrimId)
    .not('team', 'is', null)
  
  if (playersError) {
    throw new Error(`Failed to get players: ${playersError.message}`)
  }
  
  // Get current user's vote status
  let myVote = false
  try {
    const { userId } = await getCurrentUser()
    const myPlayer = players?.find(p => p.user_id === userId)
    myVote = myPlayer?.voted_reroll || false
  } catch {
    // Not logged in, that's fine
  }
  
  const statusRow = status?.[0] || { total_players: 0, votes_for_reroll: 0, votes_needed: 1, can_reroll: false }
  
  return {
    totalPlayers: statusRow.total_players,
    votesForReroll: statusRow.votes_for_reroll,
    votesNeeded: statusRow.votes_needed,
    canReroll: statusRow.can_reroll,
    voters: players?.filter(p => p.voted_reroll).map(p => p.user_name) || [],
    myVote,
  }
}

// Vote for reroll (toggle vote)
export async function voteReroll(scrimId: string): Promise<{ rerolled: boolean; status: RerollStatus }> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()
  
  // Verify scrim is in progress
  const scrim = await getScrim(scrimId)
  if (!scrim) throw new Error('Scrim not found')
  if (scrim.status !== 'in_progress') {
    throw new Error('Can only vote for reroll during in_progress phase')
  }
  
  // Get current player
  const { data: player } = await supabase
    .from('scrim_players')
    .select('*')
    .eq('scrim_id', scrimId)
    .eq('user_id', userId)
    .single()
  
  if (!player) throw new Error('You are not a participant in this scrim')
  if (!player.team) throw new Error('You must be assigned to a team to vote for reroll')
  
  // Toggle vote
  const newVote = !player.voted_reroll
  
  const { error: updateError } = await supabase
    .from('scrim_players')
    .update({ voted_reroll: newVote })
    .eq('id', player.id)
  
  if (updateError) throw new Error(`Failed to update vote: ${updateError.message}`)
  
  // Check if reroll threshold is met and execute if so
  let rerolled = false
  if (newVote) {
    const { data: rerollResult, error: rerollError } = await supabase.rpc('check_and_execute_reroll', { p_scrim_id: scrimId })
    
    if (rerollError) {
      console.error('Failed to check/execute reroll:', rerollError)
    } else {
      rerolled = rerollResult === true
    }
  }
  
  // Get updated status
  const status = await getRerollStatus(scrimId)
  
  revalidatePath('/scrim')
  revalidatePath(`/scrim/${scrimId}`)
  
  return { rerolled, status }
}

// ==================== RANKED / ELO SYSTEM ====================

export interface RankedValidationResult {
    isValid: boolean
    errors: string[]
    playerMatches: Array<{
        scrimPlayerId: string
        userId: string
        userName: string
        team: string
        gameNameLower: string | null
        sessionPlayerName: string | null
        kills: number | null
        deaths: number | null
        matched: boolean
    }>
}

// Validate and match scrim players to session stats
// Note: This no longer requires ALL players to match - it just reports which players matched
export async function validateRankedScrim(scrimId: string): Promise<RankedValidationResult> {
    const supabase = await createClient()
    const errors: string[] = []

    // Get scrim details
    const scrim = await getScrim(scrimId)
    if (!scrim) {
        return { isValid: false, errors: ['Scrim not found'], playerMatches: [] }
    }

    if (scrim.status !== 'finalized') {
        errors.push('Scrim must be finalized')
    }

    if (scrim.team_a_score === null || scrim.team_b_score === null) {
        errors.push('Scrim must have final scores')
    }

    if (!scrim.tracker_session_id) {
        errors.push('Scrim must have a linked tracker session for ELO')
    }

    // Get scrim players
    const players = await getScrimPlayers(scrimId)

    // Get all game names for these users (optional - for users who have linked names)
    const userIds = players.map(p => p.user_id)
    const { data: gameNames } = await supabase
        .from('user_game_names')
        .select('*')
        .in('user_id', userIds)

    // Create a map of user_id -> game_name_lower
    const userGameNameMap = new Map<string, string>()
    for (const gn of gameNames || []) {
        if (!userGameNameMap.has(gn.user_id)) {
            userGameNameMap.set(gn.user_id, gn.game_name_lower)
        }
    }

    // Get session stats if we have a tracker session
    let sessionPlayers: SessionPlayer[] = []
    if (scrim.tracker_session_id) {
        const stats = await getSessionStats(scrim.tracker_session_id)
        // Combine players from all linked sessions
        for (const s of stats) {
            sessionPlayers.push(...s.players)
        }
    }

    // Create a map of session player names (lowercase) -> player data
    const sessionPlayerMap = new Map<string, SessionPlayer>()
    for (const sp of sessionPlayers) {
        sessionPlayerMap.set(sp.name.toLowerCase(), sp)
    }

    // Match scrim players to session players
    // Priority: 1) linked game name, 2) Clerk display name (user_name)
    const playerMatches: RankedValidationResult['playerMatches'] = []

    for (const player of players) {
        const linkedGameName = userGameNameMap.get(player.user_id)
        const displayNameLower = player.user_name.toLowerCase()
        
        let sessionPlayer: SessionPlayer | null = null
        let matchedGameName: string | null = null
        
        // Try linked game name first
        if (linkedGameName) {
            sessionPlayer = sessionPlayerMap.get(linkedGameName) || null
            if (sessionPlayer) {
                matchedGameName = linkedGameName
            }
        }
        
        // Fall back to Clerk display name
        if (!sessionPlayer) {
            sessionPlayer = sessionPlayerMap.get(displayNameLower) || null
            if (sessionPlayer) {
                matchedGameName = displayNameLower
            }
        }

        playerMatches.push({
            scrimPlayerId: player.id,
            userId: player.user_id,
            userName: player.user_name,
            team: player.team || 'unassigned',
            gameNameLower: linkedGameName || null, // The actual linked game name (or null if not linked)
            sessionPlayerName: sessionPlayer?.name || null,
            kills: sessionPlayer?.kills || null,
            deaths: sessionPlayer?.deaths || null,
            matched: sessionPlayer !== null,
        })
    }

    // Count matched players (for informational purposes)
    const matchedCount = playerMatches.filter(p => p.matched).length

    return {
        isValid: errors.length === 0, // Only fails if scrim not finalized, no scores, or no tracker
        errors,
        playerMatches,
    }
}

// Process ranked ELO updates for a scrim
// Uses the database stored procedure for each player
// Only processes players who have linked game names that match the session
export async function processRankedScrim(scrimId: string): Promise<{
    success: boolean
    error?: string
    eloChanges?: Array<{
        gameName: string
        eloChange: number
        newElo: number
        result: 'win' | 'loss' | 'draw'
    }>
}> {
    const supabase = await createClient()

    // Get scrim details
    const scrim = await getScrim(scrimId)
    if (!scrim) return { success: false, error: 'Scrim not found' }
    
    // Check if this is a ranked scrim (only block if explicitly set to false)
    if (scrim.is_ranked === false) {
        return { success: false, error: 'This scrim is explicitly marked as not ranked' }
    }

    // Check basic requirements
    if (scrim.status !== 'finalized') {
        return { success: false, error: 'Scrim must be finalized' }
    }
    if (scrim.team_a_score === null || scrim.team_b_score === null) {
        return { success: false, error: 'Scrim must have final scores' }
    }
    if (!scrim.tracker_session_id) {
        return { success: false, error: 'Scrim must have a linked tracker session' }
    }

    // Check if already processed using the database function
    const { data: isAlreadyProcessed } = await supabase.rpc('is_scrim_ranked', { p_scrim_id: scrimId })
    if (isAlreadyProcessed) {
        return { success: false, error: 'ELO has already been processed for this scrim' }
    }

    // Get player matches
    const validation = await validateRankedScrim(scrimId)
    const matchedPlayers = validation.playerMatches.filter(p => p.matched)
    
    if (matchedPlayers.length === 0) {
        return { success: false, error: 'No players with linked game names matched the session' }
    }

    const teamAScore = scrim.team_a_score
    const teamBScore = scrim.team_b_score

    // Group matched players by team (only matched players get ELO)
    const teamAPlayers = matchedPlayers.filter(p => p.team === 'team_a')
    const teamBPlayers = matchedPlayers.filter(p => p.team === 'team_b')

    // Get current ELO for matched players to calculate team averages
    const allGameNames = matchedPlayers
        .map(p => p.gameNameLower)
        .filter((n): n is string => n !== null)

    const { data: eloRecords } = await supabase
        .from('player_elo')
        .select('*')
        .in('game_name_lower', allGameNames)

    const eloMap = new Map(eloRecords?.map(e => [e.game_name_lower, e]) || [])

    // Calculate average ELO for each team
    const getPlayerElo = (gameNameLower: string) => eloMap.get(gameNameLower)?.elo || 1200

    const teamAAvgElo = teamAPlayers.length > 0
        ? Math.round(teamAPlayers.reduce((sum, p) => sum + getPlayerElo(p.gameNameLower!), 0) / teamAPlayers.length)
        : 1200
    const teamBAvgElo = teamBPlayers.length > 0
        ? Math.round(teamBPlayers.reduce((sum, p) => sum + getPlayerElo(p.gameNameLower!), 0) / teamBPlayers.length)
        : 1200

    const eloChanges: Array<{
        gameName: string
        eloChange: number
        newElo: number
        result: 'win' | 'loss' | 'draw'
    }> = []

    // Calculate total kills per team for performance adjustment
    const teamATotalKills = teamAPlayers.reduce((sum, p) => sum + (p.kills || 0), 0)
    const teamBTotalKills = teamBPlayers.reduce((sum, p) => sum + (p.kills || 0), 0)

    // Process each matched player using the stored procedure
    for (const player of matchedPlayers) {
        const isTeamA = player.team === 'team_a'
        const roundsFor = isTeamA ? teamAScore : teamBScore
        const roundsAgainst = isTeamA ? teamBScore : teamAScore
        const opponentAvgElo = isTeamA ? teamBAvgElo : teamAAvgElo
        const teamTotalKills = isTeamA ? teamATotalKills : teamBTotalKills

        // Call the stored procedure with simplified interface
        const { data, error } = await supabase.rpc('process_player_elo', {
            p_scrim_id: scrimId,
            p_game_name: player.sessionPlayerName || player.gameNameLower,
            p_rounds_for: roundsFor,
            p_rounds_against: roundsAgainst,
            p_kills: player.kills || 0,
            p_opponent_avg_elo: opponentAvgElo,
            p_team_total_kills: teamTotalKills,
        })

        if (error) {
            console.error(`Failed to process ELO for ${player.gameNameLower}:`, error)
            continue
        }

        if (data && data.length > 0) {
            const result = data[0]
            eloChanges.push({
                gameName: result.game_name,
                eloChange: result.elo_change,
                newElo: result.elo_after,
                result: result.result as 'win' | 'loss' | 'draw',
            })
        }
    }

    // Mark ELO as processed (is_ranked is already set at creation)
    await supabase.from('scrims').update({
        ranked_processed_at: new Date().toISOString(),
    }).eq('id', scrimId)

    revalidatePath('/scrim')
    revalidatePath(`/scrim/${scrimId}`)

    return { success: true, eloChanges }
}

// Mark a scrim as ranked (or unranked)
export async function setScrimRanked(scrimId: string, isRanked: boolean): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    
    const { error } = await supabase
        .from('scrims')
        .update({ is_ranked: isRanked })
        .eq('id', scrimId)
    
    if (error) {
        return { success: false, error: error.message }
    }
    
    revalidatePath('/scrim')
    revalidatePath(`/scrim/${scrimId}`)
    
    return { success: true }
}

// Retry ELO processing for a scrim (clears ranked_processed_at first)
export async function retryEloProcessing(scrimId: string): Promise<{
    success: boolean
    error?: string
    debugInfo: Awaited<ReturnType<typeof debugEloValidation>>
    eloResult?: Awaited<ReturnType<typeof processRankedScrim>>
}> {
    const supabase = await createClient()
    
    // Get debug info first
    const debugInfo = await debugEloValidation(scrimId)
    
    console.log('=== RETRY ELO PROCESSING ===')
    console.log('Scrim ID:', scrimId)
    console.log('Session players from tracker:', debugInfo.sessionPlayers)
    console.log('Validation errors:', debugInfo.validation?.errors)
    console.log('Player matches:')
    for (const pm of debugInfo.validation?.playerMatches || []) {
        console.log(`  - ${pm.userName} (user_id: ${pm.userId.slice(0, 8)}...)`)
        console.log(`    Linked game name: ${pm.gameNameLower || 'NONE'}`)
        console.log(`    Matched to session player: ${pm.sessionPlayerName || 'NO MATCH'}`)
        console.log(`    Matched: ${pm.matched}`)
    }
    
    // Check if we can process
    if (debugInfo.scrim?.is_ranked === false) {
        console.log('Cannot process: scrim is explicitly marked as not ranked')
        return { success: false, error: 'Scrim is marked as not ranked. Click "Mark as Ranked" first.', debugInfo }
    }
    
    if (debugInfo.scrim?.status !== 'finalized') {
        console.log('Cannot process: scrim is not finalized')
        return { success: false, error: 'Scrim is not finalized', debugInfo }
    }
    
    // Clear ranked_processed_at to allow re-processing
    // BUT only if no ELO history exists (to avoid double-counting)
    const { data: existingHistory } = await supabase
        .from('elo_history')
        .select('id')
        .eq('scrim_id', scrimId)
        .limit(1)
    
    if (existingHistory && existingHistory.length > 0) {
        console.log('Cannot retry: ELO already processed (history exists)')
        return { success: false, error: 'ELO already processed for this scrim', debugInfo }
    }
    
    // Now process
    const eloResult = await processRankedScrim(scrimId)
    console.log('ELO result:', eloResult)
    console.log('============================')
    
    revalidatePath('/scrim')
    revalidatePath(`/scrim/${scrimId}`)
    
    return { success: eloResult.success, error: eloResult.error, debugInfo, eloResult }
}

// Debug function to see ELO validation results
export async function debugEloValidation(scrimId: string): Promise<{
    scrim: {
        id: string
        status: string
        is_ranked: boolean
        ranked_processed_at: string | null
        tracker_session_id: string | null
        team_a_score: number | null
        team_b_score: number | null
    } | null
    validation: RankedValidationResult | null
    sessionPlayers: string[]
    sessionPlayersLower: string[]
    scrimPlayerUserIds: Array<{ userName: string; userNameLower: string; odUserId: string }>
    linkedGameNames: Array<{ odUserId: string; gameName: string; gameNameLower: string }>
    error?: string
}> {
    const supabase = await createClient()
    
    // Get scrim details
    const scrim = await getScrim(scrimId)
    if (!scrim) {
        return { scrim: null, validation: null, sessionPlayers: [], sessionPlayersLower: [], scrimPlayerUserIds: [], linkedGameNames: [], error: 'Scrim not found' }
    }
    
    // Get session players if tracker session exists
    let sessionPlayers: string[] = []
    let sessionPlayersLower: string[] = []
    if (scrim.tracker_session_id) {
        const stats = await getSessionStats(scrim.tracker_session_id)
        for (const s of stats) {
            sessionPlayers.push(...s.players.map(p => p.name))
            sessionPlayersLower.push(...s.players.map(p => p.name.toLowerCase()))
        }
    }
    
    // Get scrim players and their user IDs
    const players = await getScrimPlayers(scrimId)
    const scrimPlayerUserIds = players.map(p => ({ 
        userName: p.user_name,
        userNameLower: p.user_name.toLowerCase(),
        odUserId: p.user_id.substring(0, 20) + '...' // Truncate for display
    }))
    
    // Get linked game names for these users
    const userIds = players.map(p => p.user_id)
    const { data: gameNames } = await supabase
        .from('user_game_names')
        .select('user_id, game_name, game_name_lower')
        .in('user_id', userIds)
    
    const linkedGameNames = (gameNames || []).map(gn => ({
        odUserId: gn.user_id.substring(0, 20) + '...',
        gameName: gn.game_name,
        gameNameLower: gn.game_name_lower,
    }))
    
    // Get validation
    const validation = await validateRankedScrim(scrimId)
    
    return {
        scrim: {
            id: scrim.id,
            status: scrim.status,
            is_ranked: scrim.is_ranked || false,
            ranked_processed_at: scrim.ranked_processed_at || null,
            tracker_session_id: scrim.tracker_session_id || null,
            team_a_score: scrim.team_a_score,
            team_b_score: scrim.team_b_score,
        },
        validation,
        sessionPlayers,
        sessionPlayersLower,
        scrimPlayerUserIds,
        linkedGameNames,
    }
}

// Get ranked status for a scrim
export async function getScrimRankedStatus(scrimId: string): Promise<{
    isRanked: boolean
    canBeRanked: boolean
    validation: RankedValidationResult | null
    eloChanges: Array<{
        gameName: string
        eloChange: number
        result: string
    }> | null
}> {
    const supabase = await createClient()

    const scrim = await getScrim(scrimId)
    if (!scrim) {
        return { isRanked: false, canBeRanked: false, validation: null, eloChanges: null }
    }

    // Check if already ranked
    const { data: scrimData } = await supabase
        .from('scrims')
        .select('is_ranked')
        .eq('id', scrimId)
        .single()

    if (scrimData?.is_ranked) {
        // Get ELO history for this scrim
        const { data: history } = await supabase
            .from('elo_history')
            .select('*')
            .eq('scrim_id', scrimId)

        return {
            isRanked: true,
            canBeRanked: false,
            validation: null,
            eloChanges: history?.map(h => ({
                gameName: h.game_name_lower,
                eloChange: h.elo_change,
                result: h.result,
            })) || null,
        }
    }

    // Validate if it can be ranked
    const validation = await validateRankedScrim(scrimId)

    return {
        isRanked: false,
        canBeRanked: validation.isValid,
        validation,
        eloChanges: null,
    }
}

// Admin user ID that can recalculate ELO
const ADMIN_USER_ID = 'user_37oDN0YOSoKb4uypcjhU0Rgodzi'

// Admin-only: Recalculate ELO for a scrim
// This reverts the previous ELO changes and recalculates using ELO values as they were at the time
export async function adminRecalculateElo(scrimId: string): Promise<{
    success: boolean
    error?: string
    revertedChanges?: Array<{ gameName: string; revertedChange: number }>
    newChanges?: Array<{ gameName: string; eloChange: number; newElo: number }>
}> {
    const { userId } = await getCurrentUser()
    const supabase = await createClient()
    
    // Enforce admin-only access
    if (userId !== ADMIN_USER_ID) {
        return { success: false, error: 'Unauthorized: Admin access required' }
    }
    
    // Get scrim details
    const scrim = await getScrim(scrimId)
    if (!scrim) {
        return { success: false, error: 'Scrim not found' }
    }
    
    if (scrim.status !== 'finalized') {
        return { success: false, error: 'Scrim must be finalized' }
    }
    
    if (!scrim.tracker_session_id) {
        return { success: false, error: 'Scrim must have a linked tracker session' }
    }
    
    // Get existing ELO history for this scrim
    const { data: existingHistory } = await supabase
        .from('elo_history')
        .select('*')
        .eq('scrim_id', scrimId)
    
    const revertedChanges: Array<{ gameName: string; revertedChange: number }> = []
    
    // Revert previous ELO changes if they exist
    if (existingHistory && existingHistory.length > 0) {
        for (const record of existingHistory) {
            // Get current ELO for this player
            const { data: currentElo } = await supabase
                .from('player_elo')
                .select('*')
                .eq('game_name_lower', record.game_name_lower)
                .single()
            
            if (currentElo) {
                // Revert: subtract the change and adjust win/loss/draw counts
                await supabase
                    .from('player_elo')
                    .update({
                        elo: currentElo.elo - record.elo_change,
                        games_played: Math.max(0, currentElo.games_played - 1),
                        wins: record.result === 'win' ? Math.max(0, currentElo.wins - 1) : currentElo.wins,
                        losses: record.result === 'loss' ? Math.max(0, currentElo.losses - 1) : currentElo.losses,
                        draws: record.result === 'draw' ? Math.max(0, currentElo.draws - 1) : currentElo.draws,
                    })
                    .eq('game_name_lower', record.game_name_lower)
                
                revertedChanges.push({
                    gameName: record.game_name_lower,
                    revertedChange: -record.elo_change,
                })
            }
        }
        
        // Delete the old ELO history for this scrim
        await supabase
            .from('elo_history')
            .delete()
            .eq('scrim_id', scrimId)
    }
    
    // Clear ranked_processed_at to allow reprocessing
    await supabase
        .from('scrims')
        .update({ ranked_processed_at: null })
        .eq('id', scrimId)
    
    // Now recalculate ELO fresh
    const result = await processRankedScrim(scrimId)
    
    revalidatePath('/scrim')
    revalidatePath(`/scrim/${scrimId}`)
    
    return {
        success: result.success,
        error: result.error,
        revertedChanges,
        newChanges: result.eloChanges?.map(c => ({
            gameName: c.gameName,
            eloChange: c.eloChange,
            newElo: c.newElo,
        })),
    }
}

// Check if current user is admin
export async function isCurrentUserAdmin(): Promise<boolean> {
    try {
        const { userId } = await getCurrentUser()
        return userId === ADMIN_USER_ID
    } catch {
        return false
    }
}

// Admin-only: Update tracker session ID (allows updating even when one exists)
export async function adminUpdateTrackerSessionId(scrimId: string, sessionIdInput: string): Promise<{
    success: boolean
    error?: string
    sessionId?: string
}> {
    const { userId } = await getCurrentUser()
    const supabase = await createClient()
    
    // Enforce admin-only access
    if (userId !== ADMIN_USER_ID) {
        return { success: false, error: 'Unauthorized: Admin access required' }
    }
    
    const scrim = await getScrim(scrimId)
    if (!scrim) {
        return { success: false, error: 'Scrim not found' }
    }
    
    // Extract and clean the session ID
    const sessionId = extractSessionId(sessionIdInput)
    
    if (!sessionId) {
        return { success: false, error: 'Session ID cannot be empty' }
    }
    
    const { error } = await supabase
        .from('scrims')
        .update({ tracker_session_id: sessionId })
        .eq('id', scrimId)
    
    if (error) {
        return { success: false, error: `Failed to update tracker link: ${error.message}` }
    }
    
    revalidatePath('/scrim')
    revalidatePath(`/scrim/${scrimId}`)
    
    return { success: true, sessionId }
}

// ==================== READ OPERATIONS FOR CLIENT COMPONENTS ====================

// Get all user game names (for matching users to in-game names)
export async function getAllUserGameNames() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_game_names')
    .select('*')

  if (error) throw new Error(`Failed to fetch game names: ${error.message}`)
  return data || []
}

// Get ELO history for a specific scrim
export async function getScrimEloHistory(scrimId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('elo_history')
    .select('*')
    .eq('scrim_id', scrimId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch ELO history: ${error.message}`)
  return data || []
}

// Get player ELO records for players in a scrim
export async function getScrimPlayerElos(scrimId: string) {
  const supabase = await createClient()

  // Get scrim players first
  const players = await getScrimPlayers(scrimId)

  // Get all game names for these users
  const userIds = players.map(p => p.user_id)
  const { data: gameNames } = await supabase
    .from('user_game_names')
    .select('user_id, game_name_lower')
    .in('user_id', userIds)

  if (!gameNames || gameNames.length === 0) return []

  // Get ELO for all these game names
  const gameName_lowers = gameNames.map(gn => gn.game_name_lower)
  const { data: eloData, error } = await supabase
    .from('player_elo')
    .select('*')
    .in('game_name_lower', gameName_lowers)

  if (error) throw new Error(`Failed to fetch player ELOs: ${error.message}`)
  return eloData || []
}

// Get complete scrim details (combined query for efficiency)
export async function getScrimDetails(scrimId: string) {
  const supabase = await createClient()

  // Fetch all data in parallel
  const [scrim, players, submissions, gameNames, eloHistory, playerElos] = await Promise.all([
    getScrim(scrimId),
    getScrimPlayers(scrimId),
    getScoreSubmissions(scrimId),
    getAllUserGameNames(),
    getScrimEloHistory(scrimId),
    getScrimPlayerElos(scrimId),
  ])

  return {
    scrim,
    players,
    submissions,
    gameNames,
    eloHistory,
    playerElos,
  }
}

