/** Live server query helpers (America's Army GameSpy-style fields). */

export interface LivePlayer {
  name: string
  ping: number
  kills: number
  deaths: number
  honor: number
  score?: number
  team?: number
  time?: string
  /** Teammate-shot / ROE penalty magnitude (from all_fields.roe_N) */
  roe: number
}

export interface LiveServerInfo {
  server_name: string
  map_name: string
  game_type?: string
  game_mode: string
  game_version?: string
  players: number
  max_players: number
  player_list: LivePlayer[]
  version?: string
  password: boolean
  ping: string
  current_round?: string
  mission_time?: string
  tickets?: string
  leader_team0?: string
  leader_team1?: string
  goal_team0?: number
  goal_team1?: number
  honor_team0?: number
  honor_team1?: number
  roe_team0?: number
  roe_team1?: number
  all_fields?: Record<string, string>
}

function parseIntField(value: string | number | undefined | null, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Attach per-player ROE from all_fields.roe_N using original list index.
 * GameSpy ROE values are typically 0 or negative penalties — we store magnitude.
 *
 * Note: all_fields.goal_0 / honor_0 / leader_0 are per-player, not team totals.
 * Team stats come from top-level server_info fields (goal_team0, etc.).
 */
export function enrichLiveServerInfo(raw: LiveServerInfo): LiveServerInfo {
  const fields = raw.all_fields || {}
  const player_list = (raw.player_list || []).map((player, i) => {
    const fromFields = fields[`roe_${i}`]
    const rawRoe =
      fromFields !== undefined
        ? parseIntField(fromFields)
        : parseIntField((player as LivePlayer & { roe?: number }).roe)
    return {
      ...player,
      roe: Math.abs(rawRoe),
    }
  })

  const teamRoe0 =
    raw.roe_team0 !== undefined
      ? Math.abs(Number(raw.roe_team0))
      : fields.roe_team0 !== undefined
        ? Math.abs(parseIntField(fields.roe_team0))
        : undefined
  const teamRoe1 =
    raw.roe_team1 !== undefined
      ? Math.abs(Number(raw.roe_team1))
      : fields.roe_team1 !== undefined
        ? Math.abs(parseIntField(fields.roe_team1))
        : undefined

  return {
    ...raw,
    player_list,
    current_round: raw.current_round ?? fields.current_round,
    mission_time: raw.mission_time ?? fields.mission_time,
    tickets: raw.tickets ?? fields.tickets,
    game_version: raw.game_version ?? fields.gamever,
    leader_team0: raw.leader_team0,
    leader_team1: raw.leader_team1,
    goal_team0: raw.goal_team0,
    goal_team1: raw.goal_team1,
    honor_team0: raw.honor_team0,
    honor_team1: raw.honor_team1,
    roe_team0: teamRoe0,
    roe_team1: teamRoe1,
  }
}

export function calculateFragRate(kills: number, deaths: number): number {
  if (deaths === 0) return kills > 0 ? kills : 0
  return Number((kills / deaths).toFixed(2))
}

export function calculateScore(kills: number, deaths: number): number {
  return kills * 10 - deaths * 10
}
