export const UNRANKED_ELO = 1200

export type TournamentPlayer = {
  name: string
  aliases: string[]
  captain?: boolean
}

export type TournamentTeam = {
  id: string
  name: string
  subtitle?: string
  shortName?: string
  region: "NA" | "EU"
  color: string
  players: TournamentPlayer[]
}

export type WeekMap = {
  name: string
  time: string
  note?: string
}

export type ScheduledMatch = {
  home: string
  away: string
  involvesEu: boolean
}

/** One map inside a pairing. Scores are home-first. */
export type MapResult = {
  name: string
  homeScore: number
  awayScore: number
  sessionId: string
}

/**
 * Recorded results. Schedule is fixtures only — this is the only place
 * scores live. One object per pairing; add a map when it is played.
 * `home` / `away` are team ids from TEAMS.
 */
export type MatchResult = {
  week: number
  home: string
  away: string
  maps: MapResult[]
}

export const MATCH_RESULTS: MatchResult[] = [
  {
    week: 1,
    home: "intro",
    away: "drob",
    maps: [
      {
        name: "Headquarters Raid",
        homeScore: 5,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1788920154",
      },
      {
        name: "Insurgent Camp",
        homeScore: 9,
        awayScore: 3,
        sessionId: "185.150.189.120:1797_1788923494",
      },
    ],
  },
]

export type ScheduleWeek = {
  week: number
  naDate: string
  euDate: string
  maps: WeekMap[]
  matches: ScheduledMatch[]
  bye: string
}

export const TEAMS: TournamentTeam[] = [
  {
    id: "intro",
    name: "Dirty Mike and the Boys",
    shortName: "Dirty Mike",
    region: "NA",
    color: "from-cyan-600 to-sky-800",
    players: [
      { name: "Intro", aliases: ["intro-", "intro"], captain: true },
      { name: "Inverse", aliases: ["judas.inverse", "inverse", "iverse"] },
      { name: "Killerpep", aliases: ["killerpep", "-killerpep"] },
      { name: "Method", aliases: ["nx.method;", "method"] },
    ],
  },
  {
    id: "joe",
    name: "WWJD",
    subtitle: "What would jibs do",
    region: "NA",
    color: "from-red-600 to-rose-800",
    players: [
      { name: "Joe", aliases: ["joe131", "joe"], captain: true },
      { name: "convix", aliases: ["convix"] },
      { name: "desi", aliases: ["desi"] },
      { name: "confusion", aliases: ["confusion"] },
    ],
  },
  {
    id: "farmer",
    name: "Hotdog",
    region: "NA",
    color: "from-emerald-600 to-green-800",
    players: [
      { name: "Farmer", aliases: ["-farmer.[vda]", "farmer"], captain: true },
      { name: "Rainmaker", aliases: ["rainmaker"] },
      { name: "Mediocre", aliases: ["mediocre"] },
      { name: "Bryguy", aliases: ["bryguy"] },
    ],
  },
  {
    id: "drob",
    name: "High T",
    region: "NA",
    color: "from-amber-500 to-orange-800",
    players: [
      { name: "Drob", aliases: ["drob", "drob127"], captain: true },
      { name: "Re1ativity2", aliases: ["re1ativity2"] },
      { name: "Xeno", aliases: ["xeno", "xenotype"] },
      { name: "Chaos", aliases: ["chaos88", "chaos"] },
    ],
  },
  {
    id: "bart",
    name: "bum ba da da",
    region: "EU",
    color: "from-violet-600 to-purple-900",
    players: [
      { name: "Bart", aliases: ["bart"], captain: true },
      { name: "Hype", aliases: ["hype"] },
      { name: "imamenace", aliases: ["imamenace"] },
      { name: "Aquaxe", aliases: ["aquaxe"] },
      { name: "Mat3r", aliases: ["tuhmat3r", "mat3r", "tuhmater"] },
    ],
  },
  {
    id: "junk",
    name: "Junk",
    region: "EU",
    color: "from-blue-600 to-indigo-900",
    players: [
      { name: "Junk", aliases: ["junk"], captain: true },
      { name: "Vasili", aliases: ["vasili"] },
      { name: "Erniaa", aliases: ["erniaa"] },
      { name: "Potejto", aliases: ["potejto"] },
      { name: "Scott", aliases: ["scott"] },
    ],
  },
  {
    id: "yoshi",
    name: "Yoshi",
    region: "EU",
    color: "from-rose-600 to-fuchsia-900",
    players: [
      { name: "Yoshi", aliases: [".yoshii^", "yoshi"], captain: true },
      { name: "cRm", aliases: ["crm"] },
      { name: "Bananen", aliases: ["bananen"] },
      { name: "Unknown", aliases: [] },
      { name: "Nukubu", aliases: ["nukubu"] },
    ],
  },
]

export const NA_CAPTAINS = ["drob", "joe", "farmer", "intro"] as const
export const EU_CAPTAINS = ["bart", "junk", "yoshi"] as const

/** Group-stage map weeks. 7-team round robin uses all 7 weeks. */
export const MAP_WEEKS: { week: number; maps: WeekMap[] }[] = [
  {
    week: 1,
    maps: [
      { name: "Headquarters Raid", time: "5 minutes" },
      { name: "Insurgent Camp", time: "3 minutes" },
    ],
  },
  {
    week: 2,
    maps: [
      { name: "MOUT McKenna", time: "3 minutes" },
      { name: "Bridge SE", time: "6 minutes", note: "5 rounds" },
    ],
  },
  {
    week: 3,
    maps: [
      { name: "Pipeline", time: "4 minutes" },
      { name: "ESL Dusk", time: "3 minutes" },
    ],
  },
  {
    week: 4,
    maps: [
      { name: "Collapsed Tunnel", time: "3 minutes" },
      { name: "River Basin", time: "7 minutes", note: "5 rounds" },
    ],
  },
  {
    week: 5,
    maps: [
      { name: "Woodland Outpost", time: "4 minutes" },
      { name: "Urban Assault", time: "3 minutes" },
    ],
  },
  {
    week: 6,
    maps: [
      { name: "SF Sandstorm", time: "3 minutes" },
      { name: "Mountain Ambush", time: "6 minutes", note: "5 rounds" },
    ],
  },
  {
    week: 7,
    maps: [
      { name: "Canyon", time: "3 minutes" },
      { name: "Weapons Cache", time: "4 minutes" },
    ],
  },
]

export const SCHEDULE: ScheduleWeek[] = [
  {
    week: 1,
    naDate: "Thu Sep 10",
    euDate: "Sat Sep 12",
    maps: MAP_WEEKS[0].maps,
    bye: "junk",
    matches: [
      { home: "farmer", away: "yoshi", involvesEu: true },
      { home: "joe", away: "bart", involvesEu: true },
      { home: "intro", away: "drob", involvesEu: false },
    ],
  },
  {
    week: 2,
    naDate: "Thu Sep 17",
    euDate: "Sat Sep 19",
    maps: MAP_WEEKS[1].maps,
    bye: "yoshi",
    matches: [
      { home: "farmer", away: "joe", involvesEu: false },
      { home: "drob", away: "junk", involvesEu: true },
      { home: "bart", away: "intro", involvesEu: true },
    ],
  },
  {
    week: 3,
    naDate: "Thu Sep 24",
    euDate: "Sat Sep 26",
    maps: MAP_WEEKS[2].maps,
    bye: "joe",
    matches: [
      { home: "farmer", away: "junk", involvesEu: true },
      { home: "yoshi", away: "intro", involvesEu: true },
      { home: "drob", away: "bart", involvesEu: true },
    ],
  },
  {
    week: 4,
    naDate: "Thu Oct 1",
    euDate: "Sat Oct 3",
    maps: MAP_WEEKS[3].maps,
    bye: "bart",
    matches: [
      { home: "farmer", away: "intro", involvesEu: false },
      { home: "junk", away: "yoshi", involvesEu: true },
      { home: "drob", away: "joe", involvesEu: false },
    ],
  },
  {
    week: 5,
    naDate: "Thu Oct 8",
    euDate: "Sat Oct 10",
    maps: MAP_WEEKS[4].maps,
    bye: "drob",
    matches: [
      { home: "farmer", away: "bart", involvesEu: true },
      { home: "intro", away: "junk", involvesEu: true },
      { home: "joe", away: "yoshi", involvesEu: true },
    ],
  },
  {
    week: 6,
    naDate: "Thu Oct 15",
    euDate: "Sat Oct 17",
    maps: MAP_WEEKS[5].maps,
    bye: "intro",
    matches: [
      { home: "farmer", away: "drob", involvesEu: false },
      { home: "bart", away: "yoshi", involvesEu: true },
      { home: "joe", away: "junk", involvesEu: true },
    ],
  },
  {
    week: 7,
    naDate: "Thu Oct 22",
    euDate: "Sat Oct 24",
    maps: MAP_WEEKS[6].maps,
    bye: "farmer",
    matches: [
      { home: "intro", away: "joe", involvesEu: false },
      { home: "drob", away: "yoshi", involvesEu: true },
      { home: "bart", away: "junk", involvesEu: true },
    ],
  },
]

export function getTeam(id: string) {
  return TEAMS.find((t) => t.id === id)
}

export function getMatchResult(week: number, home: string, away: string) {
  return MATCH_RESULTS.find(
    (m) => m.week === week && m.home === home && m.away === away
  )
}

export function seriesScore(result: MatchResult) {
  return result.maps.reduce(
    (acc, map) => ({
      homeScore: acc.homeScore + map.homeScore,
      awayScore: acc.awayScore + map.awayScore,
    }),
    { homeScore: 0, awayScore: 0 }
  )
}

/** Each map is its own match for W/L. */
export function mapRecord(result: MatchResult) {
  let homeWins = 0
  let awayWins = 0
  let ties = 0
  for (const map of result.maps) {
    if (map.homeScore > map.awayScore) homeWins++
    else if (map.awayScore > map.homeScore) awayWins++
    else ties++
  }
  return { homeWins, awayWins, ties }
}

export function allMatchSessionIds() {
  return MATCH_RESULTS.flatMap((m) => m.maps.map((map) => map.sessionId))
}

export function mapNameForSession(sessionId: string) {
  for (const match of MATCH_RESULTS) {
    const map = match.maps.find((m) => m.sessionId === sessionId)
    if (map) return map.name
  }
}

export function recordedMapNames() {
  return Array.from(
    new Set(MATCH_RESULTS.flatMap((m) => m.maps.map((map) => map.name)))
  )
}

function nameVariants(name: string) {
  const lower = name.toLowerCase().trim()
  const stripped = lower.replace(/^-+/, "")
  return stripped === lower ? [lower] : [lower, stripped]
}

export function resolveRosterPlayer(trackerName: string) {
  const incoming = nameVariants(trackerName)
  for (const team of TEAMS) {
    for (const player of team.players) {
      const aliases = [player.name, ...player.aliases]
      const matches = aliases.some((alias) => {
        const known = nameVariants(alias)
        return incoming.some((v) => known.indexOf(v) !== -1)
      })
      if (matches) {
        return { team, player }
      }
    }
  }
}

export type PlayerStatLine = {
  trackerName: string
  displayName: string
  rosterName: string | null
  teamId: string | null
  teamName: string | null
  mapName: string
  sessionId: string
  kills: number
  deaths: number
}

export type TournamentPlayerStat = {
  trackerName: string
  displayName: string
  teamId: string | null
  teamName: string | null
  kills: number
  deaths: number
  fragRate: number
}

export function annotateStatLines(
  rows: {
    name: string
    kills: number
    deaths: number
    sessionId: string
    mapName: string
  }[],
  displayByRoster: Record<string, string> = {}
): PlayerStatLine[] {
  return rows.map((row) => {
    const resolved = resolveRosterPlayer(row.name)
    const rosterName = resolved?.player.name ?? null
    const displayName =
      (rosterName && displayByRoster[rosterName]) ||
      rosterName ||
      row.name
    const trackerName =
      (rosterName && displayByRoster[rosterName]) || row.name
    return {
      trackerName,
      displayName,
      rosterName,
      teamId: resolved?.team.id ?? null,
      teamName: resolved?.team.name ?? null,
      mapName: row.mapName,
      sessionId: row.sessionId,
      kills: row.kills,
      deaths: row.deaths,
    }
  })
}

export function buildPlayerStats(
  rows: { name: string; kills: number; deaths: number }[],
  displayByRoster: Record<string, string> = {}
): TournamentPlayerStat[] {
  const lines = annotateStatLines(
    rows.map((row) => ({
      ...row,
      sessionId: "",
      mapName: "",
    })),
    displayByRoster
  )
  return aggregatePlayerStats(lines)
}

export function aggregatePlayerStats(lines: PlayerStatLine[]): TournamentPlayerStat[] {
  const byKey = new Map<
    string,
    {
      trackerName: string
      displayName: string
      teamId: string | null
      teamName: string | null
      kills: number
      deaths: number
    }
  >()

  for (const line of lines) {
    if (line.kills + line.deaths === 0) continue
    const key = line.rosterName ?? line.trackerName.toLowerCase()
    const existing = byKey.get(key)
    if (existing) {
      existing.kills += line.kills
      existing.deaths += line.deaths
    } else {
      byKey.set(key, {
        trackerName: line.trackerName,
        displayName: line.displayName,
        teamId: line.teamId,
        teamName: line.teamName,
        kills: line.kills,
        deaths: line.deaths,
      })
    }
  }

  return Array.from(byKey.values())
    .map((row) => ({
      ...row,
      fragRate:
        row.deaths === 0
          ? row.kills > 0
            ? row.kills
            : 0
          : Number((row.kills / row.deaths).toFixed(2)),
    }))
    .sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills
      if (b.fragRate !== a.fragRate) return b.fragRate - a.fragRate
      return a.displayName.localeCompare(b.displayName)
    })
}

export function teamEloSum(
  team: TournamentTeam,
  elos: Record<string, { elo: number } | undefined>
) {
  return team.players.reduce((sum, player) => {
    return sum + (elos[player.name]?.elo ?? UNRANKED_ELO)
  }, 0)
}

export type StandingRow = {
  teamId: string
  wins: number
  losses: number
  ties: number
  roundsFor: number
  roundsAgainst: number
  roundWinPct: number | null
}

export function calculateStandings(): StandingRow[] {
  const standings: Record<string, StandingRow> = Object.fromEntries(
    TEAMS.map((t) => [
      t.id,
      {
        teamId: t.id,
        wins: 0,
        losses: 0,
        ties: 0,
        roundsFor: 0,
        roundsAgainst: 0,
        roundWinPct: null,
      },
    ])
  )

  for (const match of MATCH_RESULTS) {
    const home = standings[match.home]
    const away = standings[match.away]
    if (!home || !away) continue

    for (const map of match.maps) {
      home.roundsFor += map.homeScore
      home.roundsAgainst += map.awayScore
      away.roundsFor += map.awayScore
      away.roundsAgainst += map.homeScore

      if (map.homeScore > map.awayScore) {
        home.wins++
        away.losses++
      } else if (map.awayScore > map.homeScore) {
        away.wins++
        home.losses++
      } else {
        home.ties++
        away.ties++
      }
    }
  }

  return Object.values(standings)
    .map((row) => {
      const played = row.roundsFor + row.roundsAgainst
      return {
        ...row,
        roundWinPct: played > 0 ? row.roundsFor / played : null,
      }
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      const aPct = a.roundWinPct ?? 0
      const bPct = b.roundWinPct ?? 0
      if (bPct !== aPct) return bPct - aPct
      if (b.roundsFor !== a.roundsFor) return b.roundsFor - a.roundsFor
      return a.teamId.localeCompare(b.teamId)
    })
}
