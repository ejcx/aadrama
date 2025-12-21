"use client";
import Image from "next/image";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";

// Player type with display name and optional tracker profile
interface Player {
  name: string;
  tracker?: string; // tracker profile path (without /tracker/player/)
}

// Team constants with player profiles
const TEAMS = [
  {
    name: "Next Level",
    tag: "nx",
    color: "from-blue-600 to-blue-800",
    image: "/nx.png",
    players: [
      { name: "method", tracker: "nx.method;" },
      { name: "budd", tracker: "nx.budd;" },
      { name: "intensity", tracker: "intensity-" },
      { name: "TuhMat3r", tracker: "TuhMat3r" },
      { name: "Mediocre", tracker: "Mediocre" },
    ] as Player[],
  },
  {
    name: "Ataxia",
    tag: "atx",
    color: "from-purple-600 to-purple-800",
    image: "/ataxia.png",
    players: [
      { name: "rainmaker", tracker: "rainmaker" },
      { name: "intro", tracker: "intro-" },
      { name: "effingee", tracker: "effingee" },
      { name: "rAAw", tracker: "rAAw" },
      { name: "desi", tracker: "desi" },
    ] as Player[],
  },
  {
    name: "Judas",
    tag: "judas",
    color: "from-red-600 to-red-800",
    image: "/judas.png",
    players: [
      { name: "JoE131", tracker: "JoE131" },
      { name: "Farmer", tracker: "-Farmer.[vDa]" },
      { name: "inverse", tracker: "judas.inverse" },
      { name: "Judopizza", tracker: "Judopizza" },
      { name: "Ic3y", tracker: "Ic3y" },
    ] as Player[],
  },
  {
    name: "Team 4",
    tag: "t4",
    color: "from-emerald-600 to-emerald-800",
    image: "/team4.png",
    players: [
      { name: "hyPe", tracker: "hype" },
      { name: "re1ativity2", tracker: "re1ativity2" },
      { name: "mastakilla", tracker: "-aud.mastakilla-" },
      { name: "confusion", tracker: "confusion" },
      { name: "drg", tracker: "drg-" },
    ] as Player[],
  },
] as const;

const SUBS = [
  { name: "ChaOs88", note: "Last to sign up" },
  { name: "ryan", note: "Might have to work" },
];

// Group Stage Schedule - Round Robin (all teams play each other)
const GROUP_STAGE = {
  rounds: [
    {
      round: 1,
      mapType: "Mid-Range Maps",
      matches: [
        { home: "Team 4", away: "Next Level" },
        { home: "Ataxia", away: "Judas" },
      ],
    },
    {
      round: 2,
      mapType: "Long-Range Maps",
      matches: [
        { home: "Next Level", away: "Ataxia" },
        { home: "Judas", away: "Team 4" },
      ],
    },
    {
      round: 3,
      mapType: "Short-Range Maps",
      matches: [
        { home: "Judas", away: "Next Level" },
        { home: "Team 4", away: "Ataxia" },
      ],
    },
  ],
};

const MAP_POOL = [
  {
    category: "Games 1-2: Mid-Range Maps",
    maps: [
      { name: "MOUT McKenna", time: "4 minutes" },
      { name: "Urban Assault", time: "4 minutes" },
      { name: "Canyon", time: "4 minutes" },
      { name: "Insurgent Camp", time: "4 minutes" },
      { name: "SF Sandstorm", time: "4 minutes" },
    ],
  },
  {
    category: "Game 3: Long-Range Maps",
    maps: [
      { name: "Bridge SE", time: "6 minutes" },
      { name: "Mountain Ambush", time: "6 minutes" },
      { name: "River Basin", time: "6 minutes" },
      { name: "SF Taiga", time: "6 minutes" },
      { name: "Headquarters Raid", time: "5 minutes" },
    ],
  },
  {
    category: "Games 4-5: Short-Range Maps",
    maps: [
      { name: "Collapsed Tunnel", time: "3 minutes" },
      { name: "Pipeline", time: "4 minutes" },
      { name: "ESL Dusk", time: "4 minutes" },
      { name: "Weapons Cache SE", time: "5 minutes" },
      { name: "SF CSAR", time: "5 minutes" },
    ],
  },
];

// Get team color for bracket display
const getTeamColor = (teamName: string) => {
  const team = TEAMS.find((t) => t.name === teamName);
  return team?.color || "from-gray-600 to-gray-800";
};

// Player name component with optional link
const PlayerName = ({ player }: { player: Player }) => {
  if (player.tracker) {
    return (
      <Link
        href={`/tracker/player/${encodeURIComponent(player.tracker)}`}
        className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
      >
        {player.name}
      </Link>
    );
  }
  return <span>{player.name}</span>;
};

const WinterChampionship = () => {
  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="flex flex-col items-start space-y-8 sm:space-y-12 w-full max-w-5xl">
          {/* Header with Logo */}
          <div className="w-full text-center">
            <div className="flex justify-center mb-6">
              <Image
                src="/aa.jpg"
                alt="Americas Army"
                width={80}
                height={80}
                className="rounded-xl shadow-lg shadow-cyan-500/20"
              />
            </div>
            <div className="inline-block mb-4">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/30">
                WINTER 2025
              </span>
            </div>
            <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Americas Army 2.5
            </h1>
            <h2 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
              Winter Championship
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>January 3, 2026</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>4:00 PM Eastern</span>
              </div>
            </div>
            <a
              href="https://docs.google.com/document/d/1-HpfQJa51dyiLb29guXqHth3W9YGGZKxlCOUwgPB0xQ/edit?tab=t.0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Official Rules & Format
            </a>
          </div>

          {/* Teams Section */}
          <div className="w-full">
            <h3 className="text-white text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </span>
              Competing Teams
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TEAMS.map((team) => (
                <div
                  key={team.tag}
                  className={`bg-gradient-to-br ${team.color} rounded-xl p-[1px]`}
                >
                  <div className="bg-gray-900 rounded-xl p-5 h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <Image
                        src={team.image}
                        alt={team.name}
                        width={40}
                        height={40}
                        className="rounded-lg"
                      />
                      <div>
                        <h4 className="text-white font-bold text-lg">{team.name}</h4>
                        <span className="text-gray-400 text-xs uppercase tracking-wider">{team.tag}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {team.players.map((player, idx) => (
                        <div
                          key={player.name}
                          className="flex items-center gap-2 text-gray-300 text-sm"
                        >
                          <span className="text-gray-500 w-4 text-right text-xs">{idx + 1}.</span>
                          <PlayerName player={player} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Substitutes */}
            <div className="mt-4 bg-gray-900 border border-gray-700 rounded-lg p-4">
              <h4 className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-wider">Substitutes</h4>
              <div className="flex flex-wrap gap-4">
                {SUBS.map((sub) => (
                  <div key={sub.name} className="flex items-center gap-2">
                    <span className="text-white">{sub.name}</span>
                    <span className="text-gray-500 text-xs">({sub.note})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tournament Bracket */}
          <div className="w-full">
            <h3 className="text-white text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </span>
              Group Stage
            </h3>
            
            {/* Group Stage - Single Group Round Robin */}
            <div className="bg-gray-900 border border-cyan-500/30 rounded-xl overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-bold text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Round Robin
                  </h4>
                  <div className="flex items-center gap-2">
                    {TEAMS.map((team, idx) => (
                      <Image key={idx} src={team.image} alt={team.name} width={24} height={24} className="rounded" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">
                  All 4 teams compete in a round robin format. <span className="text-cyan-400 font-medium">Top 2 seeds</span> advance to the finals.
                </p>
                {GROUP_STAGE.rounds.map((round, roundIdx) => (
                  <div key={roundIdx} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-semibold">Round {round.round}</span>
                      <span className="text-xs text-gray-400 px-2 py-1 bg-gray-700 rounded-full">{round.mapType}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {round.matches.map((match, matchIdx) => (
                        <div key={matchIdx} className="bg-gray-800 rounded-lg p-3 border border-gray-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${getTeamColor(match.home)}`}></div>
                              <span className="text-gray-200 text-sm font-medium">{match.home}</span>
                              <span className="text-green-400 text-[10px] px-1.5 py-0.5 bg-green-400/10 rounded">H</span>
                            </div>
                            <span className="text-gray-500 text-xs px-2">vs</span>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-orange-400 text-[10px] px-1.5 py-0.5 bg-orange-400/10 rounded">A</span>
                              <span className="text-gray-200 text-sm font-medium">{match.away}</span>
                              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${getTeamColor(match.away)}`}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400 mb-8">
              <div className="flex items-center gap-2">
                <span className="text-green-400 px-1.5 py-0.5 bg-green-400/10 rounded">H</span>
                <span>Home Team</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 px-1.5 py-0.5 bg-orange-400/10 rounded">A</span>
                <span>Away Team</span>
              </div>
            </div>

            {/* Finals Bracket */}
            <h3 className="text-white text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
              Finals Bracket
            </h3>

            <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-4 sm:p-6 overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Finals Bracket Visualization */}
                <div className="flex items-center justify-center gap-4">
                  {/* 1st Seed */}
                  <div className="flex-1 max-w-[200px]">
                    <div className="text-center mb-2">
                      <span className="text-xs text-amber-400 uppercase tracking-wider font-semibold">1st Seed</span>
                    </div>
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-600 p-0.5 rounded-lg">
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="flex justify-center gap-1 mb-2">
                          {TEAMS.map((team, idx) => (
                            <Image key={idx} src={team.image} alt={team.name} width={24} height={24} className="rounded opacity-40" />
                          ))}
                        </div>
                        <div className="text-amber-400 font-bold text-sm">TBD</div>
                        <div className="text-gray-500 text-xs mt-1">Top ranked team</div>
                      </div>
                    </div>
                  </div>

                  {/* Connector Lines and VS */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-px bg-gradient-to-r from-amber-500 to-amber-500"></div>
                    <div className="relative">
                      <div className="absolute -left-4 top-1/2 w-4 h-px bg-amber-500"></div>
                      <div className="absolute -right-4 top-1/2 w-4 h-px bg-cyan-500"></div>
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 rounded-xl">
                        <div className="bg-gray-900 rounded-xl px-6 py-4 text-center">
                          <svg className="w-6 h-6 text-amber-400 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <div className="text-amber-400 font-bold text-lg">FINALS</div>
                          <div className="text-gray-400 text-xs mt-1">Best of 14</div>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-px bg-gradient-to-r from-amber-500 to-cyan-500"></div>
                  </div>

                  {/* 2nd Seed */}
                  <div className="flex-1 max-w-[200px]">
                    <div className="text-center mb-2">
                      <span className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">2nd Seed</span>
                    </div>
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-0.5 rounded-lg">
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="flex justify-center gap-1 mb-2">
                          {TEAMS.map((team, idx) => (
                            <Image key={idx} src={team.image} alt={team.name} width={24} height={24} className="rounded opacity-40" />
                          ))}
                        </div>
                        <div className="text-cyan-400 font-bold text-sm">TBD</div>
                        <div className="text-gray-500 text-xs mt-1">2nd ranked team</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tournament Flow Arrow */}
                <div className="flex justify-center mt-6">
                  <div className="flex flex-col items-center">
                    <svg className="w-5 h-5 text-amber-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>

                {/* Champion */}
                <div className="flex justify-center mt-4">
                  <div className="bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 p-0.5 rounded-xl">
                    <div className="bg-gray-900 rounded-xl px-8 py-4 text-center">
                      <div className="flex justify-center mb-2">
                        <div className="relative">
                          <svg className="w-10 h-10 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 3h14a2 2 0 012 2v4a8 8 0 01-8 8 8 8 0 01-8-8V5a2 2 0 012-2zm7 18v-4m-4 6h8" />
                          </svg>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="text-amber-400 font-bold text-xl">CHAMPION</div>
                      <div className="text-gray-400 text-xs mt-1">Winter 2025</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Finals Info */}
            <div className="mt-6 bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl p-5">
              <h4 className="text-amber-400 font-bold text-lg mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Finals Format
              </h4>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  The <span className="text-amber-400 font-medium">1st seed</span> faces the <span className="text-cyan-400 font-medium">2nd seed</span> from group play in a Best of 14 final match (7-7 tie possible).
                </p>
                <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">1.</span>
                    <span><span className="text-amber-400">High seed</span> submits 3 maps from at least 2 map pools</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">2.</span>
                    <span><span className="text-cyan-400">Low seed</span> picks the map to be played from those 3</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">3.</span>
                    <span><span className="text-amber-400">High seed</span> picks starting sides</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">4.</span>
                    <span>Teams swap sides after the 7th round</span>
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <p className="text-gray-400">
                    <span className="text-white font-medium">Tiebreaker (7-7):</span> Sudden death on a map selected by high seed. Low seed picks sides (no swap). First team to win a round wins the match.
                  </p>
                </div>
                <p className="text-gray-500 text-xs italic">
                  Optional: Group stage losers may play for 3rd place honor & glory.
                </p>
              </div>
            </div>
          </div>

          {/* Map Pool Section */}
          <div className="w-full">
            <h3 className="text-white text-xl sm:text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </span>
              Map Pool
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MAP_POOL.map((category) => (
                <div
                  key={category.category}
                  className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
                    <h4 className="text-white font-semibold text-sm">{category.category}</h4>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {category.maps.map((map) => (
                        <div
                          key={map.name}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-300">
                            {map.name}
                          </span>
                          <span className="text-gray-500 text-xs">{map.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules Link Footer */}
          <div className="w-full text-center pt-4 border-t border-gray-800">
            <a
              href="https://docs.google.com/document/d/1-HpfQJa51dyiLb29guXqHth3W9YGGZKxlCOUwgPB0xQ/edit?tab=t.0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Complete Rules & Regulations
            </a>
          </div>

          {/* Special Thanks */}
          <div className="w-full">
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
              <h4 className="text-amber-400 font-semibold mb-3 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Special Thanks
              </h4>
              <p className="text-gray-300 text-sm">
                Thank you to{" "}
                <Link
                  href="/tracker/player/effingee"
                  className="text-purple-400 hover:text-purple-300 font-medium hover:underline transition-colors"
                >
                  effingee
                </Link>
                {" "}and{" "}
                <Link
                  href="/tracker/player/-Farmer.[vDa]"
                  className="text-red-400 hover:text-red-300 font-medium hover:underline transition-colors"
                >
                  Farmer
                </Link>
                {" "}for helping organize this tournament!
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default WinterChampionship;
