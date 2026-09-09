import {
  MATCH_RESULTS,
  annotateStatLines,
  mapNameForSession,
  type PlayerStatLine,
} from "./fall-2026"

const API_BASE = "https://server-details.ej.workers.dev"

type SessionPlayer = {
  name: string
  kills: number
  deaths: number
}

async function fetchSessionPlayers(sessionId: string): Promise<SessionPlayer[]> {
  const res = await fetch(
    `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/players`,
    { cache: "no-store" }
  )
  if (!res.ok) return []
  const data = await res.json()
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.players)) return data.players
  return []
}

export async function fetchTournamentPlayerLines(
  displayByRoster: Record<string, string> = {}
): Promise<PlayerStatLine[]> {
  const sessionIds = MATCH_RESULTS.flatMap((m) =>
    m.maps.map((map) => map.sessionId)
  )
  const rows = (
    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const players = await fetchSessionPlayers(sessionId)
        const mapName = mapNameForSession(sessionId) ?? "Unknown"
        return players.map((p) => ({
          name: p.name,
          kills: p.kills,
          deaths: p.deaths,
          sessionId,
          mapName,
        }))
      })
    )
  ).flat()
  return annotateStatLines(rows, displayByRoster)
}
