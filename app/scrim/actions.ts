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
  
  // Automatically process ELO for ranked scrims when session ID is added
  if (data.is_ranked && data.status === 'finalized' && !data.ranked_processed_at) {
    try {
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
            gameNameLower: matchedGameName,
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
    
    // Check if this is a ranked scrim
    if (!scrim.is_ranked) {
        return { success: false, error: 'This is not a ranked scrim' }
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

    // Process each matched player using the stored procedure
    for (const player of matchedPlayers) {
        const isTeamA = player.team === 'team_a'
        const roundsFor = isTeamA ? teamAScore : teamBScore
        const roundsAgainst = isTeamA ? teamBScore : teamAScore
        const opponentAvgElo = isTeamA ? teamBAvgElo : teamAAvgElo

        // Call the stored procedure with simplified interface
        const { data, error } = await supabase.rpc('process_player_elo', {
            p_scrim_id: scrimId,
            p_game_name: player.sessionPlayerName || player.gameNameLower,
            p_rounds_for: roundsFor,
            p_rounds_against: roundsAgainst,
            p_kills: player.kills || 0,
            p_opponent_avg_elo: opponentAvgElo,
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

