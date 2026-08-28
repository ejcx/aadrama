export const UNRANKED_ELO = 1200

export type TournamentPlayer = {
  name: string
  aliases: string[]
  captain?: boolean
}

export type TournamentTeam = {
  id: string
  name: string
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
  homeScore?: number
  awayScore?: number
}

export type ScheduleWeek = {
  week: number
  naDate: string
  euDate: string
  maps: WeekMap[]
  matches: ScheduledMatch[]
}

export const TEAMS: TournamentTeam[] = [
  {
    id: "intro",
    name: "Intro",
    region: "NA",
    color: "from-cyan-600 to-sky-800",
    players: [
      { name: "Intro", aliases: ["intro-", "intro"], captain: true },
      { name: "Inverse", aliases: ["judas.inverse", "inverse"] },
      { name: "Killerpep", aliases: ["killerpep"] },
      { name: "Method", aliases: ["nx.method;", "method"] },
    ],
  },
  {
    id: "joe",
    name: "Joe",
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
    name: "Farmer",
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
    name: "Drob",
    region: "NA",
    color: "from-amber-500 to-orange-800",
    players: [
      { name: "Drob", aliases: ["drob"], captain: true },
      { name: "Re1ativity2", aliases: ["re1ativity2"] },
      { name: "Xeno", aliases: ["xeno"] },
      { name: "Chaos", aliases: ["chaos88", "chaos"] },
    ],
  },
  {
    id: "bart",
    name: "Bart",
    region: "EU",
    color: "from-violet-600 to-purple-900",
    players: [
      { name: "Bart", aliases: ["bart"], captain: true },
      { name: "Yoshi", aliases: [".yoshii^", "yoshi"] },
      { name: "Tuhmater", aliases: ["tuhmat3r", "tuhmater"] },
      { name: "Nukubu", aliases: ["nukubu"] },
    ],
  },
  {
    id: "junk",
    name: "Junk",
    region: "EU",
    color: "from-blue-600 to-indigo-900",
    players: [
      { name: "Junk", aliases: ["junk"], captain: true },
      { name: "Hype", aliases: ["hype"] },
      { name: "imamenace", aliases: ["imamenace"] },
      { name: "unknown", aliases: [] },
    ],
  },
]

export const NA_CAPTAINS = ["drob", "joe", "farmer", "intro"] as const
export const EU_CAPTAINS = ["bart", "junk"] as const

/** Group-stage map weeks. With 6 teams, weeks 1–5 are used; 6–7 are the 8-team calendar. */
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
      { name: "SF Hospital", time: "4 minutes" },
    ],
  },
  {
    week: 4,
    maps: [
      { name: "Collapsed Tunnel", time: "3 minutes" },
      { name: "River Basin", time: "6 minutes", note: "5 rounds" },
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
    matches: [
      { home: "intro", away: "junk", involvesEu: true },
      { home: "joe", away: "bart", involvesEu: true },
      { home: "farmer", away: "drob", involvesEu: false },
    ],
  },
  {
    week: 2,
    naDate: "Thu Sep 17",
    euDate: "Sat Sep 19",
    maps: MAP_WEEKS[1].maps,
    matches: [
      { home: "intro", away: "bart", involvesEu: true },
      { home: "drob", away: "junk", involvesEu: true },
      { home: "joe", away: "farmer", involvesEu: false },
    ],
  },
  {
    week: 3,
    naDate: "Thu Sep 24",
    euDate: "Sat Sep 26",
    maps: MAP_WEEKS[2].maps,
    matches: [
      { home: "intro", away: "drob", involvesEu: false },
      { home: "farmer", away: "bart", involvesEu: true },
      { home: "joe", away: "junk", involvesEu: true },
    ],
  },
  {
    week: 4,
    naDate: "Thu Oct 1",
    euDate: "Sat Oct 3",
    maps: MAP_WEEKS[3].maps,
    matches: [
      { home: "intro", away: "farmer", involvesEu: false },
      { home: "joe", away: "drob", involvesEu: false },
      { home: "bart", away: "junk", involvesEu: true },
    ],
  },
  {
    week: 5,
    naDate: "Thu Oct 8",
    euDate: "Sat Oct 10",
    maps: MAP_WEEKS[4].maps,
    matches: [
      { home: "intro", away: "joe", involvesEu: false },
      { home: "farmer", away: "junk", involvesEu: true },
      { home: "drob", away: "bart", involvesEu: true },
    ],
  },
]

export function getTeam(id: string) {
  return TEAMS.find((t) => t.id === id)
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
  points: number
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
        points: 0,
        roundWinPct: null,
      },
    ])
  )

  for (const week of SCHEDULE) {
    for (const match of week.matches) {
      if (match.homeScore == null || match.awayScore == null) continue
      const home = standings[match.home]
      const away = standings[match.away]
      home.roundsFor += match.homeScore
      home.roundsAgainst += match.awayScore
      away.roundsFor += match.awayScore
      away.roundsAgainst += match.homeScore

      if (match.homeScore > match.awayScore) {
        home.wins++
        away.losses++
      } else if (match.awayScore > match.homeScore) {
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
        points: row.wins * 3 + row.ties,
        roundWinPct: played > 0 ? row.roundsFor / played : null,
      }
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      const aPct = a.roundWinPct ?? 0
      const bPct = b.roundWinPct ?? 0
      if (bPct !== aPct) return bPct - aPct
      return a.teamId.localeCompare(b.teamId)
    })
}
