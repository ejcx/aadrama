import { describe, expect, it } from "vitest"
import {
  MATCH_RESULTS,
  SCHEDULE,
  TEAMS,
  aggregatePlayerStats,
  annotateStatLines,
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
      wins: 5,
      losses: 2,
      ties: 1,
      roundsFor: 60,
      roundsAgainst: 34,
    })
    expect(standings.drob).toMatchObject({
      wins: 8,
      losses: 1,
      ties: 1,
      roundsFor: 67,
      roundsAgainst: 49,
    })
    expect(standings.joe).toMatchObject({
      wins: 6,
      losses: 4,
      ties: 0,
      roundsFor: 65,
      roundsAgainst: 50,
    })
    expect(standings.farmer).toMatchObject({
      wins: 4,
      losses: 4,
      ties: 2,
      roundsFor: 61,
      roundsAgainst: 55,
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
      losses: 10,
      ties: 0,
      roundsFor: 24,
      roundsAgainst: 92,
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

  it("stores week 4 High T vs WWJD as two High T map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 4 && m.home === "drob" && m.away === "joe"
    )
    expect(match?.maps).toEqual([
      {
        name: "Collapsed Tunnel",
        homeScore: 8,
        awayScore: 4,
        sessionId: "185.150.189.120:1797_1791941387",
      },
      {
        name: "Mountain Ambush",
        homeScore: 6,
        awayScore: 4,
        sessionId: "185.150.189.120:1797_1791943374",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 14, awayScore: 8 })
  })

  it("stores week 4 Hotdog vs Team Poland as two Hotdog map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 4 && m.home === "farmer" && m.away === "junk"
    )
    expect(match?.maps).toEqual([
      {
        name: "Collapsed Tunnel",
        homeScore: 9,
        awayScore: 3,
        sessionId: "185.150.189.120:1797_1792268114",
      },
      {
        name: "Mountain Ambush",
        homeScore: 8,
        awayScore: 2,
        sessionId: "185.150.189.120:1797_1792270024",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 17, awayScore: 5 })
  })

  it("stores week 5 Hotdog vs High T as a tie and a High T map win", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 5 && m.home === "farmer" && m.away === "drob"
    )
    expect(match?.maps).toEqual([
      {
        name: "Woodland Outpost",
        homeScore: 6,
        awayScore: 6,
        sessionId: "185.150.189.120:1797_1792807294",
      },
      {
        name: "Urban Assault",
        homeScore: 5,
        awayScore: 7,
        sessionId: "185.150.189.120:1797_1792810434",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 11, awayScore: 13 })
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

  it("stores week 5 Dirty Mike vs Team Poland as two Dirty Mike map wins", () => {
    const match = MATCH_RESULTS.find(
      (m) => m.week === 5 && m.home === "intro" && m.away === "junk"
    )
    expect(TEAMS.find((t) => t.id === "intro")?.name).toBe(
      "Dirty Mike and the Boys"
    )
    expect(match?.maps).toEqual([
      {
        name: "Woodland Outpost",
        homeScore: 11,
        awayScore: 1,
        sessionId: "185.150.189.120:1797_1791745070",
      },
      {
        name: "Urban Assault",
        homeScore: 10,
        awayScore: 2,
        sessionId: "185.150.189.120:1797_1791747427",
      },
    ])
    expect(seriesScore(match!)).toEqual({ homeScore: 21, awayScore: 3 })
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
    expect(
      resolveRosterPlayer("-nukubu.", ["Bart", "Hype", "Banana"])?.team.id
    ).toBe("bart")
    expect(
      resolveRosterPlayer("-nukubu.", ["+JunK+", "ERNIAA", "poTejto"])?.team.id
    ).toBe("junk")
    expect(
      resolveRosterPlayer("-nukubu.", ["+JunK+", "ERNIAA", "poTejto"])?.player
        .ringer
    ).toBe(true)
    expect(resolveRosterPlayer("TuhMat3r")?.team.id).toBe("intro")
    expect(resolveRosterPlayer("TuhMat3r")?.player).toMatchObject({
      ringer: true,
      ringerFor: "Method",
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

  it("counts kills per map and per round from the recorded scores", () => {
    const lines = annotateStatLines([
      {
        name: "iverse",
        kills: 11,
        deaths: 5,
        sessionId: "185.150.189.120:1797_1791745070",
        mapName: "Woodland Outpost",
      },
      {
        name: "iverse",
        kills: 13,
        deaths: 3,
        sessionId: "185.150.189.120:1797_1791747427",
        mapName: "Urban Assault",
      },
    ])
    expect(lines.map((line) => line.rounds)).toEqual([12, 12])
    expect(aggregatePlayerStats(lines)[0]).toMatchObject({
      kills: 24,
      matches: 2,
      rounds: 24,
      killsPerMatch: 12,
      killsPerRound: 1,
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
