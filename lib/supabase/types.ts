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
  is_ranked: boolean
  ranked_processed_at: string | null
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
  reroll_votes: number
  score_submission_count: number
}

export interface ScrimPlayer {
  id: string
  scrim_id: string
  user_id: string
  user_name: string
  is_ready: boolean
  team: Team | null
  voted_reroll: boolean
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
  is_ranked?: boolean
}

// User Game Names - mapping user accounts to in-game names
export interface UserGameName {
  id: string
  user_id: string
  game_name: string
  game_name_lower: string
  created_at: string
}

export interface CreateGameNameInput {
  game_name: string
}

// ELO System
export interface PlayerElo {
  id: string
  game_name_lower: string
  game_name: string
  elo: number
  games_played: number
  wins: number
  losses: number
  draws: number
  created_at: string
  updated_at: string
}

export interface EloHistory {
  id: string
  game_name_lower: string
  scrim_id: string
  elo_before: number
  elo_after: number
  elo_change: number
  result: 'win' | 'loss' | 'draw'
  team: 'team_a' | 'team_b'
  team_score: number
  opponent_score: number
  kills: number | null
  deaths: number | null
  k_factor: number
  created_at: string
}

export interface EloLeaderboardEntry {
  game_name_lower: string
  game_name: string
  elo: number
  games_played: number
  wins: number
  losses: number
  draws: number
  win_rate: number
  user_id: string | null
  updated_at: string
}

