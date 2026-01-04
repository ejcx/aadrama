// Database types for the scrim system

export type ScrimStatus = 
  | 'waiting' 
  | 'ready_check' 
  | 'in_progress' 
  | 'scoring' 
  | 'finalized' 
  | 'expired' 
  | 'cancelled'

export type Team = 'team_a' | 'team_b'

export type Winner = 'team_a' | 'team_b' | 'draw'

export interface Scrim {
  id: string
  created_by: string
  created_by_name: string | null
  title: string | null
  map: string | null
  max_players_per_team: number
  min_players_per_team: number
  status: ScrimStatus
  team_a_score: number | null
  team_b_score: number | null
  winner: Winner | null
  tracker_session_id: string | null
  created_at: string
  expires_at: string
  ready_check_at: string | null
  started_at: string | null
  finished_at: string | null
  finalized_at: string | null
}

export interface ScrimWithCounts extends Scrim {
  player_count: number
  ready_count: number
  score_submission_count: number
}

export interface ScrimPlayer {
  id: string
  scrim_id: string
  user_id: string
  user_name: string
  is_ready: boolean
  team: Team | null
  joined_at: string
  ready_at: string | null
}

export interface ScrimScoreSubmission {
  id: string
  scrim_id: string
  user_id: string
  user_name: string | null
  team_a_score: number
  team_b_score: number
  submitted_at: string
}

// For creating new scrims
export interface CreateScrimInput {
  title?: string
  map?: string
  max_players_per_team?: number
  min_players_per_team?: number
}

