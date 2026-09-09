import { describe, expect, it } from "vitest"
import {
  MATCH_RESULTS,
  buildPlayerStats,
  calculateStandings,
  resolveRosterPlayer,
  seriesScore,
} from "./fall-2026"

describe("Fall Classic match results", () => {
  it("stores week 1 intro vs drob as two maps with session ids", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 1 && m.home === "intro" && m.away === "drob"
    )
    expect(match?.maps).toEqual([
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
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 14, awayScore: 10 })
  })

  it("counts each map as a match win, then rounds", () => {
    const standings = Object.fromEntries(
      calculateStandings().map((row) => [row.teamId, row])
    )
    expect(standings.intro).toMatchObject({
      wins: 1,
      losses: 1,
      ties: 0,
      roundsFor: 14,
      roundsAgainst: 10,
    })
    expect(standings.drob).toMatchObject({
      wins: 1,
      losses: 1,
      ties: 0,
      roundsFor: 10,
      roundsAgainst: 14,
    })
    expect(standings.joe.wins + standings.joe.losses + standings.joe.ties).toBe(0)
    expect(calculateStandings()[0].teamId).toBe("intro")
    expect(calculateStandings()[1].teamId).toBe("drob")
  })

  it("maps tracker names onto roster players", () => {
    expect(resolveRosterPlayer("iverse")?.player.name).toBe("Inverse")
    expect(resolveRosterPlayer("drob127")?.player.name).toBe("Drob")
    expect(resolveRosterPlayer("-KillerPep")?.player.name).toBe("Killerpep")
    expect(resolveRosterPlayer("xenotype")?.team.id).toBe("drob")
  })

  it("aggregates kills and deaths and skips spectators", () => {
    const stats = buildPlayerStats([
      { name: "iverse", kills: 7, deaths: 8 },
      { name: "iverse", kills: 13, deaths: 4 },
      { name: "JoE131", kills: 0, deaths: 0 },
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      displayName: "Inverse",
      trackerName: "iverse",
      teamId: "intro",
      kills: 20,
      deaths: 12,
      fragRate: 1.67,
    })
  })

  it("uses roster tracker names when provided", () => {
    const stats = buildPlayerStats(
      [{ name: "iverse", kills: 7, deaths: 8 }],
      { Inverse: "iverse" }
    )
    expect(stats[0].displayName).toBe("iverse")
    expect(stats[0].trackerName).toBe("iverse")
  })
})
