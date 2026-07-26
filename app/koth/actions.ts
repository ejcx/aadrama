'use server'

import { createClient } from '@/lib/supabase/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { calculateTeamEloChange, type KothMatchResult } from '@/lib/koth/elo'
import { playersPerTeam, totalPlayersNeeded, type KothFormat } from '@/lib/koth/format'
import { isKothMap } from '@/lib/koth/maps'
import { buildRosterKey } from '@/lib/koth/roster'
import type {
  CreateKothMatchInput,
  KothMatch,
  KothMatchPlayer,
  KothMatchWithCounts,
  KothTeam,
  Team,
} from '@/lib/supabase/types'

async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const user = await currentUser()
  const userName = user?.username || user?.firstName || 'Anonymous'

  return { userId, userName }
}

function revalidateKoth() {
  revalidatePath('/koth')
  revalidatePath('/tracker/koth')
}

export async function createKothMatch(input: CreateKothMatchInput): Promise<KothMatch> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()

  const format = input.format
  if (format !== 1 && format !== 2 && format !== 3) {
    throw new Error('Format must be 1v1, 2v2, or 3v3')
  }
  if (!isKothMap(input.map)) {
    throw new Error('Invalid King of the Hill map')
  }
  const teamName = input.teamName.trim()
  if (!teamName) throw new Error('Team name is required')
  if (teamName.length > 32) throw new Error('Team name must be 32 characters or fewer')

  const { data: match, error } = await supabase
    .from('koth_matches')
    .insert({
      created_by: userId,
      created_by_name: userName,
      format,
      map: input.map,
      team_a_name: teamName,
      team_b_name: 'Challenger',
      status: 'waiting',
    })
    .select()
    .single()

  if (error || !match) throw new Error(error?.message || 'Failed to create match')

  const { error: joinError } = await supabase.from('koth_match_players').insert({
    match_id: match.id,
    user_id: userId,
    user_name: userName,
    team: 'team_a',
    is_ready: false,
  })

  if (joinError) {
    await supabase.from('koth_matches').delete().eq('id', match.id)
    throw new Error(joinError.message || 'Failed to join created match')
  }

  revalidateKoth()
  return match as KothMatch
}

export async function getActiveKothMatches(): Promise<KothMatchWithCounts[]> {
  const supabase = await createClient()
  await supabase.rpc('expire_stale_koth_matches')

  const { data, error } = await supabase
    .from('koth_matches_with_counts')
    .select('*')
    .in('status', ['waiting', 'in_progress', 'scoring'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as KothMatchWithCounts[]
}

export async function getRecentKothMatches(limit = 20): Promise<KothMatchWithCounts[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('koth_matches_with_counts')
    .select('*')
    .in('status', ['finalized', 'cancelled', 'expired'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data || []) as KothMatchWithCounts[]
}

export async function getKothMatch(matchId: string): Promise<KothMatchWithCounts | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('koth_matches_with_counts')
    .select('*')
    .eq('id', matchId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as KothMatchWithCounts) || null
}

export async function getKothMatchPlayers(matchId: string): Promise<KothMatchPlayer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('koth_match_players')
    .select('*')
    .eq('match_id', matchId)
    .order('joined_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as KothMatchPlayer[]
}

export async function joinKothTeam(
  matchId: string,
  team: Team,
  teamName?: string
): Promise<KothMatchPlayer> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()

  const { data: match, error: matchError } = await supabase
    .from('koth_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (matchError || !match) throw new Error('Match not found')
  if (match.status !== 'waiting') throw new Error('Match is not open for joining')

  const format = match.format as KothFormat
  const capacity = playersPerTeam(format)

  const { data: existing } = await supabase
    .from('koth_match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) throw new Error('You are already in this match')

  const { count, error: countError } = await supabase
    .from('koth_match_players')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('team', team)

  if (countError) throw new Error(countError.message)
  if ((count || 0) >= capacity) throw new Error(`${team === 'team_a' ? match.team_a_name : match.team_b_name} is full`)

  if (teamName?.trim()) {
    const name = teamName.trim()
    if (name.length > 32) throw new Error('Team name must be 32 characters or fewer')
    const nameColumn = team === 'team_a' ? 'team_a_name' : 'team_b_name'
    await supabase.from('koth_matches').update({ [nameColumn]: name }).eq('id', matchId)
  }

  const { data: player, error } = await supabase
    .from('koth_match_players')
    .insert({
      match_id: matchId,
      user_id: userId,
      user_name: userName,
      team,
      is_ready: false,
    })
    .select()
    .single()

  if (error || !player) throw new Error(error?.message || 'Failed to join')

  revalidateKoth()
  return player as KothMatchPlayer
}

export async function leaveKothMatch(matchId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('koth_matches')
    .select('status, created_by')
    .eq('id', matchId)
    .single()

  if (!match) throw new Error('Match not found')
  if (match.status !== 'waiting') throw new Error('Can only leave while waiting')

  const { error } = await supabase
    .from('koth_match_players')
    .delete()
    .eq('match_id', matchId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  // If creator leaves, cancel the match
  if (match.created_by === userId) {
    await supabase
      .from('koth_matches')
      .update({ status: 'cancelled' })
      .eq('id', matchId)
      .eq('status', 'waiting')
  }

  revalidateKoth()
}

export async function setKothTeamName(matchId: string, name: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Team name is required')
  if (trimmed.length > 32) throw new Error('Team name must be 32 characters or fewer')

  const { data: match } = await supabase
    .from('koth_matches')
    .select('status')
    .eq('id', matchId)
    .single()

  if (!match) throw new Error('Match not found')
  if (match.status !== 'waiting' && match.status !== 'in_progress') {
    throw new Error('Cannot rename team now')
  }

  const { data: player } = await supabase
    .from('koth_match_players')
    .select('team')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!player) throw new Error('You are not in this match')

  const column = player.team === 'team_a' ? 'team_a_name' : 'team_b_name'
  const { error } = await supabase
    .from('koth_matches')
    .update({ [column]: trimmed })
    .eq('id', matchId)

  if (error) throw new Error(error.message)
  revalidateKoth()
}

export async function toggleKothReady(matchId: string): Promise<KothMatchPlayer> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()

  const { data: player, error: playerError } = await supabase
    .from('koth_match_players')
    .select('*')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .single()

  if (playerError || !player) throw new Error('You are not in this match')

  const { data: match } = await supabase
    .from('koth_matches')
    .select('status')
    .eq('id', matchId)
    .single()

  if (!match || match.status !== 'waiting') {
    throw new Error('Ready up is only available while waiting')
  }

  const nextReady = !player.is_ready
  const { data: updated, error } = await supabase
    .from('koth_match_players')
    .update({
      is_ready: nextReady,
      ready_at: nextReady ? new Date().toISOString() : null,
    })
    .eq('id', player.id)
    .select()
    .single()

  if (error || !updated) throw new Error(error?.message || 'Failed to toggle ready')

  await tryStartKothMatchIfReady(matchId)
  revalidateKoth()
  return updated as KothMatchPlayer
}

export async function tryStartKothMatchIfReady(matchId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('koth_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match || match.status !== 'waiting') return false

  const format = match.format as KothFormat
  const needed = totalPlayersNeeded(format)
  const perTeam = playersPerTeam(format)

  const { data: players } = await supabase
    .from('koth_match_players')
    .select('*')
    .eq('match_id', matchId)

  if (!players || players.length !== needed) return false
  if (!players.every((p) => p.is_ready)) return false

  const teamA = players.filter((p) => p.team === 'team_a')
  const teamB = players.filter((p) => p.team === 'team_b')
  if (teamA.length !== perTeam || teamB.length !== perTeam) return false

  const { error } = await supabase
    .from('koth_matches')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'waiting')

  if (error) throw new Error(error.message)
  revalidateKoth()
  return true
}

export async function endKothMatch(matchId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('koth_matches')
    .select('status, created_by')
    .eq('id', matchId)
    .single()

  if (!match) throw new Error('Match not found')
  if (match.status !== 'in_progress') throw new Error('Match is not in progress')

  const { data: player } = await supabase
    .from('koth_match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!player && match.created_by !== userId) {
    throw new Error('Only participants can end the match')
  }

  const { error } = await supabase
    .from('koth_matches')
    .update({
      status: 'scoring',
      finished_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'in_progress')

  if (error) throw new Error(error.message)
  revalidateKoth()
}

export async function submitKothScore(
  matchId: string,
  teamAScore: number,
  teamBScore: number
): Promise<{ finalized: boolean }> {
  const { userId, userName } = await getCurrentUser()
  const supabase = await createClient()

  if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
    throw new Error('Scores must be non-negative integers')
  }

  const { data: match } = await supabase
    .from('koth_matches')
    .select('status')
    .eq('id', matchId)
    .single()

  if (!match) throw new Error('Match not found')
  if (match.status !== 'scoring') throw new Error('Match is not in scoring phase')

  const { data: player } = await supabase
    .from('koth_match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!player) throw new Error('Only participants can submit scores')

  const { error: upsertError } = await supabase.from('koth_score_submissions').upsert(
    {
      match_id: matchId,
      user_id: userId,
      user_name: userName,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'match_id,user_id' }
  )

  if (upsertError) throw new Error(upsertError.message)

  const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_koth_match', {
    p_match_id: matchId,
  })

  if (finalizeError) throw new Error(finalizeError.message)

  if (finalized) {
    await processKothTeamElo(matchId)
  }

  revalidateKoth()
  return { finalized: !!finalized }
}

export async function cancelKothMatch(matchId: string): Promise<void> {
  const { userId } = await getCurrentUser()
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('koth_matches')
    .select('created_by, status')
    .eq('id', matchId)
    .single()

  if (!match) throw new Error('Match not found')
  if (match.created_by !== userId) throw new Error('Only the creator can cancel')
  if (match.status !== 'waiting') throw new Error('Can only cancel waiting matches')

  const { error } = await supabase
    .from('koth_matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId)

  if (error) throw new Error(error.message)
  revalidateKoth()
}

async function upsertKothTeam(params: {
  format: KothFormat
  userIds: string[]
  names: string[]
  displayName: string
}): Promise<KothTeam> {
  const supabase = await createClient()
  const rosterKey = buildRosterKey(params.userIds)

  const { data: existing } = await supabase
    .from('koth_teams')
    .select('*')
    .eq('format', params.format)
    .eq('roster_key', rosterKey)
    .maybeSingle()

  if (existing) {
    const { data: updated, error } = await supabase
      .from('koth_teams')
      .update({
        name: params.displayName,
        member_names: params.names,
        member_user_ids: [...params.userIds].sort(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error || !updated) throw new Error(error?.message || 'Failed to update team')
    return updated as KothTeam
  }

  const { data: created, error } = await supabase
    .from('koth_teams')
    .insert({
      format: params.format,
      roster_key: rosterKey,
      name: params.displayName,
      member_user_ids: [...params.userIds].sort(),
      member_names: params.names,
    })
    .select()
    .single()

  if (error || !created) throw new Error(error?.message || 'Failed to create team')
  return created as KothTeam
}

export async function processKothTeamElo(matchId: string): Promise<void> {
  const supabase = await createClient()

  const { data: match } = await supabase
    .from('koth_matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match) return
  if (match.status !== 'finalized') return
  if (match.elo_processed_at) return
  if (match.team_a_score == null || match.team_b_score == null || !match.winner) return

  const { data: players } = await supabase
    .from('koth_match_players')
    .select('*')
    .eq('match_id', matchId)

  if (!players) return

  const format = match.format as KothFormat
  const teamAPlayers = players.filter((p) => p.team === 'team_a')
  const teamBPlayers = players.filter((p) => p.team === 'team_b')

  if (teamAPlayers.length !== format || teamBPlayers.length !== format) return

  const teamA = await upsertKothTeam({
    format,
    userIds: teamAPlayers.map((p) => p.user_id),
    names: teamAPlayers.map((p) => p.user_name),
    displayName: match.team_a_name,
  })
  const teamB = await upsertKothTeam({
    format,
    userIds: teamBPlayers.map((p) => p.user_id),
    names: teamBPlayers.map((p) => p.user_name),
    displayName: match.team_b_name,
  })

  const resultFor = (side: 'team_a' | 'team_b'): KothMatchResult => {
    if (match.winner === 'draw') return 'draw'
    return match.winner === side ? 'win' : 'loss'
  }

  const applySide = async (
    team: KothTeam,
    opponent: KothTeam,
    side: 'team_a' | 'team_b'
  ) => {
    const result = resultFor(side)
    const teamScore = side === 'team_a' ? match.team_a_score! : match.team_b_score!
    const opponentScore = side === 'team_a' ? match.team_b_score! : match.team_a_score!
    const { change, kFactor } = calculateTeamEloChange({
      teamElo: team.elo,
      opponentElo: opponent.elo,
      result,
      teamScore,
      opponentScore,
      gamesPlayed: team.games_played,
    })

    const eloAfter = team.elo + change
    const { error: histError } = await supabase.from('koth_elo_history').insert({
      team_id: team.id,
      match_id: matchId,
      elo_before: team.elo,
      elo_after: eloAfter,
      elo_change: change,
      result,
      team_score: teamScore,
      opponent_score: opponentScore,
      k_factor: kFactor,
    })

    if (histError) {
      // Unique violation = already processed for this team
      if (histError.code === '23505') return
      throw new Error(histError.message)
    }

    const { error: updateError } = await supabase
      .from('koth_teams')
      .update({
        elo: eloAfter,
        games_played: team.games_played + 1,
        wins: team.wins + (result === 'win' ? 1 : 0),
        losses: team.losses + (result === 'loss' ? 1 : 0),
        draws: team.draws + (result === 'draw' ? 1 : 0),
      })
      .eq('id', team.id)

    if (updateError) throw new Error(updateError.message)
  }

  // Snapshot both ELOs before applying either change
  const teamASnapshot = { ...teamA }
  const teamBSnapshot = { ...teamB }

  await applySide(teamASnapshot, teamBSnapshot, 'team_a')
  await applySide(teamBSnapshot, teamASnapshot, 'team_b')

  await supabase
    .from('koth_matches')
    .update({
      team_a_id: teamA.id,
      team_b_id: teamB.id,
      elo_processed_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  revalidateKoth()
}

export async function getKothLeaderboard(format: KothFormat, limit = 50): Promise<KothTeam[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('koth_teams')
    .select('*')
    .eq('format', format)
    .gte('games_played', 1)
    .order('elo', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data || []) as KothTeam[]
}
