import { describe, expect, it } from "vitest"
import {
  MATCH_RESULTS,
  SCHEDULE,
  TEAMS,
  buildPlayerStats,
  calculateStandings,
  resolveRosterPlayer,
  seriesScore,
} from "./fall-2026"

describe("Fall Classic schedule", () => {
  it("is a 6-team 5-week round robin with intro vs drob in week 1", () => {
    expect(TEAMS.map((t) => t.id)).toEqual([
      "intro",
      "joe",
      "farmer",
      "drob",
      "bart",
      "junk",
    ])
    expect(SCHEDULE).toHaveLength(5)
    const pairs = SCHEDULE.flatMap((week) =>
      week.matches.map((m) => [m.home, m.away].sort().join("-"))
    )
    expect(pairs).toHaveLength(15)
    expect(new Set(pairs).size).toBe(15)
    expect(SCHEDULE[0].matches).toEqual(
      expect.arrayContaining([
        { home: "intro", away: "drob", involvesEu: false },
        { home: "farmer", away: "joe", involvesEu: false },
        { home: "junk", away: "bart", involvesEu: true },
      ])
    )
  })
})

describe("Fall Classic match results", () => {
  it("stores week 1 farmer vs joe as two WWJD map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 1 && m.home === "farmer" && m.away === "joe"
    )
    expect(match?.maps).toEqual([
      {
        name: "Headquarters Raid",
        homeScore: 5,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1789522774",
      },
      {
        name: "Insurgent Camp",
        homeScore: 4,
        awayScore: 8,
        sessionId: "185.150.189.120:1797_1789526074",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 9, awayScore: 15 })
  })

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
      wins: 3,
      losses: 1,
      ties: 0,
      roundsFor: 24,
      roundsAgainst: 22,
    })
    expect(standings.joe).toMatchObject({
      wins: 2,
      losses: 0,
      ties: 0,
      roundsFor: 15,
      roundsAgainst: 9,
    })
    expect(standings.farmer).toMatchObject({
      wins: 0,
      losses: 2,
      ties: 0,
      roundsFor: 9,
      roundsAgainst: 15,
    })
    expect(standings.bart).toMatchObject({
      wins: 2,
      losses: 2,
      ties: 0,
      roundsFor: 27,
      roundsAgainst: 19,
    })
    expect(standings.junk).toMatchObject({
      wins: 0,
      losses: 2,
      ties: 0,
      roundsFor: 5,
      roundsAgainst: 19,
    })
    expect(calculateStandings()[0].teamId).toBe("drob")
    expect(calculateStandings()[1].teamId).toBe("joe")
  })

  it("stores week 2 bart vs drob as two High T map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 2 && m.home === "bart" && m.away === "drob"
    )
    expect(match?.maps).toEqual([
      {
        name: "MOUT McKenna",
        homeScore: 5,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1789934676",
      },
      {
        name: "Bridge SE",
        homeScore: 3,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1789936750",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 8, awayScore: 14 })
  })

  it("stores week 1 Team Poland vs bum ba da da as two bart map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 1 && m.home === "junk" && m.away === "bart"
    )
    expect(TEAMS.find((t) => t.id === "junk")?.name).toBe("Team Poland")
    expect(match?.maps).toEqual([
      {
        name: "Headquarters Raid",
        homeScore: 2,
        awayScore: 10,
        sessionId: "45.77.52.236:1807_1789844114",
      },
      {
        name: "Insurgent Camp",
        homeScore: 3,
        awayScore: 9,
        sessionId: "45.77.52.236:1807_1789847203",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 5, awayScore: 19 })
  })

  it("maps tracker names onto roster players", () => {
    expect(resolveRosterPlayer("iverse")?.player.name).toBe("Inverse")
    expect(resolveRosterPlayer("drob127")?.player.name).toBe("Drob")
    expect(resolveRosterPlayer("-KillerPep")?.player.name).toBe("Killerpep")
    expect(resolveRosterPlayer("xenotype")?.team.id).toBe("drob")
    expect(resolveRosterPlayer("di.mediocre")?.player.name).toBe("Mediocre")
    expect(resolveRosterPlayer(".Bart^")?.team.id).toBe("bart")
    expect(resolveRosterPlayer("+JunK+")?.team.name).toBe("Team Poland")
    expect(resolveRosterPlayer(".YOshii^")?.player.name).toBe("Yoshii")
    expect(resolveRosterPlayer("bananainpyjama")?.player.name).toBe("Banana")
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
