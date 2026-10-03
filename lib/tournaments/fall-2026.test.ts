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
      wins: 3,
      losses: 2,
      ties: 1,
      roundsFor: 39,
      roundsAgainst: 31,
    })
    expect(standings.drob).toMatchObject({
      wins: 5,
      losses: 1,
      ties: 0,
      roundsFor: 40,
      roundsAgainst: 30,
    })
    expect(standings.joe).toMatchObject({
      wins: 6,
      losses: 2,
      ties: 0,
      roundsFor: 57,
      roundsAgainst: 36,
    })
    expect(standings.farmer).toMatchObject({
      wins: 2,
      losses: 3,
      ties: 1,
      roundsFor: 33,
      roundsAgainst: 37,
    })
    expect(standings.bart).toMatchObject({
      wins: 3,
      losses: 5,
      ties: 0,
      roundsFor: 48,
      roundsAgainst: 45,
    })
    expect(standings.junk).toMatchObject({
      wins: 0,
      losses: 6,
      ties: 0,
      roundsFor: 16,
      roundsAgainst: 54,
    })
    expect(calculateStandings()[0].teamId).toBe("joe")
    expect(calculateStandings()[1].teamId).toBe("drob")
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

  it("stores week 2 farmer vs intro as a MOUT tie and Dirty Mike Bridge win", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 2 && m.home === "farmer" && m.away === "intro"
    )
    expect(match?.maps).toEqual([
      {
        name: "MOUT McKenna",
        homeScore: 6,
        awayScore: 6,
        sessionId: "185.150.189.120:1797_1790127814",
      },
      {
        name: "Bridge SE",
        homeScore: 3,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1790131434",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 9, awayScore: 13 })
  })

  it("stores week 2 Team Poland vs WWJD as two WWJD map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 2 && m.home === "junk" && m.away === "joe"
    )
    expect(match?.maps).toEqual([
      {
        name: "MOUT McKenna",
        homeScore: 2,
        awayScore: 10,
        sessionId: "185.150.189.120:1797_1790455965",
      },
      {
        name: "Bridge SE",
        homeScore: 1,
        awayScore: 9,
        sessionId: "185.150.189.120:1797_1790458334",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 3, awayScore: 19 })
  })

  it("stores week 3 joe vs intro as a split", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 3 && m.home === "joe" && m.away === "intro"
    )
    expect(match?.maps).toEqual([
      {
        name: "Pipeline",
        homeScore: 8,
        awayScore: 4,
        sessionId: "185.150.189.120:1797_1790731764",
      },
      {
        name: "SF Sandstorm",
        homeScore: 4,
        awayScore: 8,
        sessionId: "185.150.189.120:1797_1790734774",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 12, awayScore: 12 })
  })

  it("stores week 3 drob vs junk as two High T map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 3 && m.home === "drob" && m.away === "junk"
    )
    expect(match?.maps).toEqual([
      {
        name: "Pipeline",
        homeScore: 7,
        awayScore: 5,
        sessionId: "185.150.189.120:1797_1791057869",
      },
      {
        name: "SF Sandstorm",
        homeScore: 9,
        awayScore: 3,
        sessionId: "185.150.189.120:1797_1791060143",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 16, awayScore: 8 })
  })

  it("stores week 3 farmer vs bart as two Hotdog map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 3 && m.home === "farmer" && m.away === "bart"
    )
    expect(match?.maps).toEqual([
      {
        name: "Pipeline",
        homeScore: 7,
        awayScore: 5,
        sessionId: "185.150.189.120:1797_1791052306",
      },
      {
        name: "SF Sandstorm",
        homeScore: 8,
        awayScore: 4,
        sessionId: "185.150.189.120:1797_1791055418",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 15, awayScore: 9 })
  })

  it("stores week 5 joe vs bart as a split", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 5 && m.home === "joe" && m.away === "bart"
    )
    expect(match?.maps).toEqual([
      {
        name: "Woodland Outpost",
        homeScore: 5,
        awayScore: 7,
        sessionId: "185.150.189.120:1777_1791060716",
      },
      {
        name: "Urban Assault",
        homeScore: 6,
        awayScore: 5,
        sessionId: "185.150.189.120:1797_1791063347",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 11, awayScore: 12 })
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
    expect(resolveRosterPlayer("Army-=Of-God=-")?.player.name).toBe("Army")
    expect(resolveRosterPlayer("Army-=Of-God=-")?.team.id).toBe("farmer")
    expect(
      resolveRosterPlayer("Army-=Of-God=-", ["JoE131", "hill", "confusion"])
        ?.team.id
    ).toBe("joe")
    expect(resolveRosterPlayer("hill")?.player.ringer).toBe(true)
    expect(resolveRosterPlayer("hill")?.team.id).toBe("joe")
    expect(resolveRosterPlayer("nx.budd;")?.team.id).toBe("drob")
    expect(resolveRosterPlayer("nx.budd;")?.player).toMatchObject({
      ringer: true,
      ringerFor: "Xeno",
    })
    expect(resolveRosterPlayer("Scott")?.team.id).toBe("farmer")
    expect(resolveRosterPlayer("Scott")?.player).toMatchObject({
      ringer: true,
      ringerFor: "Mediocre",
    })
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
