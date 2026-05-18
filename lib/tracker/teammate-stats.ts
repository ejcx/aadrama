export type RankedGame = {
  gameNameLower: string
  scrimId: string
  result: 'win' | 'loss' | 'draw'
  /** Rounds scored by the subject's team in this scrim. */
  roundsFor: number
  /** Rounds scored against the subject's team in this scrim. */
  roundsAgainst: number
  kills: number
  map: string | null
}

export type TeammateComparisonInput = {
  subject: string
  teammate: string
  mode: 'with' | 'without'
  /** When set, only ranked scrims on this map count. */
  map?: string
}

export type TeammateStatsResult = {
  subject: string
  subjectDisplay: string
  teammate: string
  teammateDisplay: string
  mode: 'with' | 'without'
  wins: number
  losses: number
  draws: number
  games: number
  winPct: number | null
  roundsWon: number
  roundsLost: number
  roundWinPct: number | null
  totalKills: number
  /** Average kills per ranked scrim in this slice. */
  fragRate: number | null
  map: string | null
  label: string
}

/** Same scrim + same ranked result = teammates (from elo_history). */
export function computeTeammateStats(
  games: RankedGame[],
  displayNames: Map<string, string>,
  comparisons: TeammateComparisonInput[]
): TeammateStatsResult[] {
  const scrimRoster = new Map<string, Map<string, Set<string>>>()

  for (const g of games) {
    let byResult = scrimRoster.get(g.scrimId)
    if (!byResult) {
      byResult = new Map()
      scrimRoster.set(g.scrimId, byResult)
    }
    let players = byResult.get(g.result)
    if (!players) {
      players = new Set()
      byResult.set(g.result, players)
    }
    players.add(g.gameNameLower)
  }

  const subjectGames = new Map<string, RankedGame[]>()
  for (const g of games) {
    const list = subjectGames.get(g.gameNameLower) ?? []
    list.push(g)
    subjectGames.set(g.gameNameLower, list)
  }

  const display = (lower: string) => displayNames.get(lower) ?? lower

  return comparisons
    .filter((c) => c.subject && c.teammate)
    .map((c) => {
      const subject = c.subject.toLowerCase()
      const teammate = c.teammate.toLowerCase()
      const playerGames = subjectGames.get(subject) ?? []

      let wins = 0
      let losses = 0
      let draws = 0
      let roundsWon = 0
      let roundsLost = 0
      let totalKills = 0

      for (const g of playerGames) {
        if (c.map && g.map !== c.map) continue

        const onTeam =
          scrimRoster.get(g.scrimId)?.get(g.result)?.has(teammate) ?? false
        const include = c.mode === 'with' ? onTeam : !onTeam
        if (!include) continue

        if (g.result === 'win') wins++
        else if (g.result === 'loss') losses++
        else draws++

        roundsWon += g.roundsFor
        roundsLost += g.roundsAgainst
        totalKills += g.kills
      }

      const games = wins + losses + draws
      const fragRate =
        games > 0 ? Math.round((10 * totalKills) / games) / 10 : null
      const winPct =
        wins + losses > 0 ? Math.round((1000 * wins) / (wins + losses)) / 10 : null
      const roundWinPct =
        roundsWon + roundsLost > 0
          ? Math.round((1000 * roundsWon) / (roundsWon + roundsLost)) / 10
          : null

      const modeLabel = c.mode === 'with' ? 'with' : 'without'
      const mapSuffix = c.map ? ` · ${c.map}` : ''
      const label = `${display(subject)} ${modeLabel} ${display(teammate)}${mapSuffix}`

      return {
        subject,
        subjectDisplay: display(subject),
        teammate,
        teammateDisplay: display(teammate),
        mode: c.mode,
        map: c.map ?? null,
        wins,
        losses,
        draws,
        games,
        winPct,
        roundsWon,
        roundsLost,
        roundWinPct,
        totalKills,
        fragRate,
        label,
      }
    })
}
