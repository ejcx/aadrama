export type RankedGame = {
  gameNameLower: string
  scrimId: string
  result: 'win' | 'loss' | 'draw'
  roundsFor: number
  roundsAgainst: number
  kills: number
  map: string | null
}

export type TeammateComparisonMode =
  | 'with'
  | 'without'
  | 'against'
  | 'everyone_but'
  | 'all_teammates'

export type TeammateComparisonInput = {
  subject: string
  teammate: string
  mode: TeammateComparisonMode
  map?: string
}

export type TeammateStatsResult = {
  subject: string
  subjectDisplay: string
  teammate: string
  teammateDisplay: string
  mode: TeammateComparisonMode
  wins: number
  losses: number
  draws: number
  games: number
  winPct: number | null
  roundsWon: number
  roundsLost: number
  roundWinPct: number | null
  totalKills: number
  fragRate: number | null
  map: string | null
  label: string
}

export function comparisonNeedsFullScrimRoster(mode: TeammateComparisonMode): boolean {
  return mode === 'everyone_but' || mode === 'all_teammates'
}

function teamOnScrim(
  roster: Map<string, Map<string, Set<string>>>,
  scrimId: string,
  result: string
): Set<string> {
  return roster.get(scrimId)?.get(result) ?? new Set()
}

function isAgainst(
  roster: Map<string, Map<string, Set<string>>>,
  scrimId: string,
  subjectResult: string,
  teammate: string
): boolean {
  const byResult = roster.get(scrimId)
  if (!byResult) return false
  let found = false
  byResult.forEach((players, result) => {
    if (!found && result !== subjectResult && players.has(teammate)) {
      found = true
    }
  })
  return found
}

function gameMatchesComparison(
  roster: Map<string, Map<string, Set<string>>>,
  subject: string,
  teammate: string,
  mode: TeammateComparisonMode,
  game: RankedGame
): boolean {
  const teammates = teamOnScrim(roster, game.scrimId, game.result)
  const onTeam = teammates.has(teammate)

  switch (mode) {
    case 'with':
      return onTeam
    case 'without':
      return !onTeam
    case 'against':
      return isAgainst(roster, game.scrimId, game.result, teammate)
    case 'everyone_but': {
      if (onTeam) return false
      const others = Array.from(teammates).filter((p) => p !== subject)
      return others.length > 0
    }
    case 'all_teammates': {
      const others = Array.from(teammates).filter((p) => p !== subject)
      return others.length > 0
    }
    default:
      return false
  }
}

export function buildComparisonLabel(
  subjectDisplay: string,
  teammateDisplay: string,
  mode: TeammateComparisonMode,
  map?: string
): string {
  const mapSuffix = map ? ` · ${map}` : ''
  switch (mode) {
    case 'with':
      return `${subjectDisplay} with ${teammateDisplay}${mapSuffix}`
    case 'without':
      return `${subjectDisplay} without ${teammateDisplay} on team${mapSuffix}`
    case 'against':
      return `${subjectDisplay} against ${teammateDisplay}${mapSuffix}`
    case 'everyone_but':
      return `${subjectDisplay} with everyone but ${teammateDisplay}${mapSuffix}`
    case 'all_teammates':
      return `${subjectDisplay} with any ranked teammate${mapSuffix}`
    default:
      return `${subjectDisplay}${mapSuffix}`
  }
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
    .filter(
      (c) =>
        c.subject &&
        (c.mode === 'all_teammates' || c.teammate)
    )
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

        if (
          !gameMatchesComparison(
            scrimRoster,
            subject,
            teammate,
            c.mode,
            g
          )
        ) {
          continue
        }

        if (g.result === 'win') wins++
        else if (g.result === 'loss') losses++
        else draws++

        roundsWon += g.roundsFor
        roundsLost += g.roundsAgainst
        totalKills += g.kills
      }

      const gameCount = wins + losses + draws
      const fragRate =
        gameCount > 0 ? Math.round((10 * totalKills) / gameCount) / 10 : null
      const winPct =
        wins + losses > 0
          ? Math.round((1000 * wins) / (wins + losses)) / 10
          : null
      const roundWinPct =
        roundsWon + roundsLost > 0
          ? Math.round((1000 * roundsWon) / (roundsWon + roundsLost)) / 10
          : null

      const subjectDisplay = display(subject)
      const teammateDisplay =
        c.mode === 'all_teammates' ? '—' : display(teammate)

      return {
        subject,
        subjectDisplay,
        teammate,
        teammateDisplay,
        mode: c.mode,
        map: c.map ?? null,
        wins,
        losses,
        draws,
        games: gameCount,
        winPct,
        roundsWon,
        roundsLost,
        roundWinPct,
        totalKills,
        fragRate,
        label: buildComparisonLabel(
          subjectDisplay,
          teammateDisplay === '—' ? 'others' : teammateDisplay,
          c.mode,
          c.map
        ),
      }
    })
}

export function mergeRankedGames(
  primary: RankedGame[],
  extra: RankedGame[]
): RankedGame[] {
  const seen = new Set(
    primary.map((g) => `${g.scrimId}:${g.gameNameLower}`)
  )
  const merged = [...primary]
  for (const g of extra) {
    const key = `${g.scrimId}:${g.gameNameLower}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(g)
    }
  }
  return merged
}
