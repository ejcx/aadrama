import type { Metadata } from "next";
import Link from "next/link";
import SidebarLayout from "../components/SidebarLayout";
import { lookupRosterElos } from "../tracker/actions";
import {
  calculateStandings,
  getTeam,
  MAP_WEEKS,
  SCHEDULE,
  TEAMS,
  UNRANKED_ELO,
  teamEloSum,
  type TournamentTeam,
} from "@/lib/tournaments/fall-2026";

export const metadata: Metadata = {
  title: "Fall Classic 2026 — AA Drama",
  description:
    "Americas Army 2.5 Fall Classic: 7-team round robin, best of 14, finals in late October.",
};

function formatElo(n: number) {
  return Math.round(n).toLocaleString();
}

function formatPct(n: number | null) {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function PlayerRow({
  player,
  elo,
}: {
  player: TournamentTeam["players"][number];
  elo?: { elo: number; tracker: string; ranked: boolean };
}) {
  const handle = elo?.tracker || player.name;

  const label = (
    <span className={`truncate ${player.captain ? "font-medium text-white" : "text-gray-200"}`}>
      {handle}
      {player.captain && (
        <span className="ml-1 text-amber-400" title="Captain">
          ★
        </span>
      )}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {elo?.tracker ? (
        <Link
          href={`/tracker/player/${encodeURIComponent(elo.tracker)}`}
          className="min-w-0 hover:underline"
        >
          {label}
        </Link>
      ) : (
        <span className="min-w-0">{label}</span>
      )}
      <span
        className={`shrink-0 tabular-nums ${elo?.ranked ? "text-gray-200" : "text-gray-500"}`}
      >
        {elo ? formatElo(elo.elo) : "—"}
      </span>
    </div>
  );
}

export default async function FallClassic2026Page() {
  const roster = TEAMS.flatMap((team) => team.players);
  const elos = await lookupRosterElos(roster);

  const teamsWithElo = TEAMS.map((team) => {
    const sum = teamEloSum(team, elos);
    const rankedCount = team.players.filter((p) => elos[p.name]?.ranked).length;
    return { team, sum, avg: sum / team.players.length, rankedCount };
  }).sort((a, b) => b.sum - a.sum);

  const eloByTeamId = Object.fromEntries(
    teamsWithElo.map(({ team, sum }) => [team.id, sum])
  );
  const standings = calculateStandings();
  const anyResults = standings.some((s) => s.wins + s.losses + s.ties > 0);
  const orderedStandings = anyResults
    ? standings
    : [...standings].sort(
        (a, b) => (eloByTeamId[b.teamId] ?? 0) - (eloByTeamId[a.teamId] ?? 0)
      );

  return (
    <SidebarLayout>
      <div className="flex flex-col items-center px-4 py-6 sm:px-6 sm:py-12 md:px-8">
        <div className="flex w-full max-w-5xl flex-col items-start space-y-10 sm:space-y-12">
          <div className="w-full text-center">
            <div className="mb-4 inline-block">
              <span className="rounded-full border border-orange-500/30 bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-400">
                FALL 2026
              </span>
            </div>
            <h1 className="mb-2 bg-gradient-to-r from-orange-400 via-amber-300 to-cyan-400 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl md:text-5xl">
              Americas Army 2.5
            </h1>
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
              Fall Classic
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-sm text-gray-400 sm:text-base">
              Round-robin group stage on AAO25 Assist. Top 2 advance to a two-map
              final. Organized in the AA: Competitive Community Discord.
            </p>
            <div className="mb-2 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300">
              <span>Sep 10 – Oct 24, 2026</span>
              <span className="text-gray-600">·</span>
              <span>Best of 14 (first to 8)</span>
              <span className="text-gray-600">·</span>
              <span>US servers</span>
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-2 text-xl font-bold text-white sm:text-2xl">
              Teams
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              ★ captain. Collective ELO is the sum of each roster (unranked
              players count as {UNRANKED_ELO}). Sorted by team ELO.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {teamsWithElo.map(({ team, sum, avg, rankedCount }, idx) => (
                <div
                  key={team.id}
                  className={`rounded-xl bg-gradient-to-br p-[1px] ${team.color}`}
                >
                  <div className="h-full rounded-xl bg-gray-900 p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-500">
                            #{idx + 1}
                          </span>
                          <h4 className="text-lg font-bold text-white">
                            Team {team.name}
                          </h4>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              team.region === "EU"
                                ? "bg-violet-500/20 text-violet-300"
                                : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {team.region}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {rankedCount}/{team.players.length} ranked
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums text-white">
                          {formatElo(sum)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">
                          avg {formatElo(avg)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {team.players.map((player) => (
                        <PlayerRow
                          key={player.name}
                          player={player}
                          elo={elos[player.name]}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-6 text-xl font-bold text-white sm:text-2xl">
              Standings
            </h3>
            <div className="overflow-hidden rounded-xl border border-cyan-500/30 bg-gray-900">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs uppercase text-gray-400">
                      <th className="px-3 py-3 text-left">#</th>
                      <th className="px-3 py-3 text-left">Team</th>
                      <th className="px-3 py-3 text-center">W</th>
                      <th className="px-3 py-3 text-center">L</th>
                      <th className="px-3 py-3 text-center">T</th>
                      <th className="px-3 py-3 text-center">Pts</th>
                      <th className="px-3 py-3 text-center">Rnd %</th>
                      <th className="px-3 py-3 text-right">ELO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedStandings.map((row, idx) => {
                      const team = getTeam(row.teamId);
                      const qualified = anyResults && idx < 2;
                      return (
                        <tr
                          key={row.teamId}
                          className={`border-b border-gray-800/60 ${
                            qualified ? "bg-cyan-500/10" : ""
                          }`}
                        >
                          <td className="px-3 py-3">
                            <span
                              className={`font-bold ${
                                idx === 0
                                  ? "text-amber-400"
                                  : idx === 1
                                    ? "text-cyan-400"
                                    : "text-gray-500"
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${team?.color}`}
                              />
                              <span
                                className={`font-medium ${qualified ? "text-white" : "text-gray-300"}`}
                              >
                                {team?.name}
                              </span>
                              {qualified && (
                                <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-[10px] text-cyan-400">
                                  Finals
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center font-medium text-green-400">
                            {row.wins}
                          </td>
                          <td className="px-3 py-3 text-center font-medium text-red-400">
                            {row.losses}
                          </td>
                          <td className="px-3 py-3 text-center font-medium text-yellow-400">
                            {row.ties}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-white">
                            {row.points}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums text-gray-400">
                            {formatPct(row.roundWinPct)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-400">
                            {formatElo(eloByTeamId[row.teamId] ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-gray-800 px-4 py-3 text-xs text-gray-500">
                Match win = 3 pts, tie = 1 pt. Round win percentage is the final
                group-stage tiebreaker. Top 2 advance.
              </p>
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-3 text-xl font-bold text-white sm:text-2xl">
              Schedule
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              Seven teams, one bye each week. Thursday for all-NA matches,
              Saturday when an EU team is involved. Teams can play any agreed
              time; one match per week unless both sides want two.
            </p>
            <div className="space-y-4">
              {SCHEDULE.map((week) => (
                <div
                  key={week.week}
                  className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900"
                >
                  <div className="flex flex-col gap-2 border-b border-gray-800 bg-gray-800/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-white">
                      Round {week.week}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-700/80 px-2 py-1 text-gray-300">
                        Bye {getTeam(week.bye)?.name}
                      </span>
                      <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-cyan-300">
                        NA {week.naDate}
                      </span>
                      <span className="rounded-full bg-violet-500/15 px-2 py-1 text-violet-300">
                        EU {week.euDate}
                      </span>
                    </div>
                  </div>
                  <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
                    {week.maps.map((m, i) => (
                      <span key={m.name}>
                        {i > 0 && <span className="text-gray-600"> · </span>}
                        <span className="text-gray-300">{m.name}</span>{" "}
                        {m.time}
                        {m.note ? ` (${m.note})` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                    {week.matches.map((match) => {
                      const home = getTeam(match.home);
                      const away = getTeam(match.away);
                      const played =
                        match.homeScore != null && match.awayScore != null;
                      return (
                        <div
                          key={`${match.home}-${match.away}`}
                          className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`text-[10px] font-semibold uppercase ${
                                match.involvesEu
                                  ? "text-violet-400"
                                  : "text-cyan-400"
                              }`}
                            >
                              {match.involvesEu ? week.euDate : week.naDate}
                            </span>
                            {!played && (
                              <span className="text-[10px] text-gray-500">
                                Upcoming
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                              <span
                                className={`h-2 w-2 rounded-full bg-gradient-to-r ${home?.color}`}
                              />
                              {home?.name}
                            </span>
                            <span className="text-xs text-gray-500">vs</span>
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-200">
                              {away?.name}
                              <span
                                className={`h-2 w-2 rounded-full bg-gradient-to-r ${away?.color}`}
                              />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-6 text-xl font-bold text-white sm:text-2xl">
              Finals
            </h3>
            <div className="rounded-xl border border-amber-500/30 bg-gray-900 p-5 sm:p-6">
              <p className="mb-4 text-sm text-gray-300">
                Top 2 from group play meet in a two-map final. If round totals are
                tied, a third map is the tiebreaker. Maps TBD. Target window is the
                last week of October, or the first week of November if makeups are
                needed.
              </p>
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-amber-500/20 bg-gray-800/60 p-4 text-center">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    1st seed
                  </div>
                  <div className="text-gray-500">TBD</div>
                </div>
                <div className="text-center text-xs font-bold uppercase tracking-widest text-amber-500">
                  vs
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-gray-800/60 p-4 text-center">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                    2nd seed
                  </div>
                  <div className="text-gray-500">TBD</div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-6 text-xl font-bold text-white sm:text-2xl">
              Map pool
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              Seven teams: group play uses all 7 map weeks. Each team has one bye.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MAP_WEEKS.map((week) => {
                return (
                  <div
                    key={week.week}
                    className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900"
                  >
                    <div className="flex items-center justify-between border-b border-gray-800 bg-gray-800/50 px-4 py-2">
                      <span className="text-sm font-semibold text-white">
                        Week {week.week}
                      </span>
                    </div>
                    <div className="space-y-2 p-4">
                      {week.maps.map((map) => (
                        <div
                          key={map.name}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-gray-300">{map.name}</span>
                          <span className="shrink-0 text-xs text-gray-500">
                            {map.time}
                            {map.note ? ` · ${map.note}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full">
            <h3 className="mb-6 text-xl font-bold text-white sm:text-2xl">
              Rules
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                {
                  title: "Format",
                  body: "Round robin: every team plays each other once, with one bye week. Matches are best of 14 (first to 8). Rounds and matches may tie. Top 2 go to the final.",
                },
                {
                  title: "How rounds are won",
                  body: "Eliminate all enemies, or hold the most transferable objectives at round end.",
                },
                {
                  title: "Dead rounds",
                  body: "Either team may call a round dead in global chat within the first 30 seconds, unless a player has already been killed.",
                },
                {
                  title: "Servers",
                  body: "US-based servers unless both teams agree otherwise. All games on AA 2.5 via AAO25 Assist.",
                },
                {
                  title: "Scheduling",
                  body: "One match a week by default; two if both teams agree. If no time can be found, both teams take 0–14 unless one side is clearly unreasonable.",
                },
                {
                  title: "Forfeits & tiebreakers",
                  body: "Teams may forfeit remaining rounds, but round win percentage is the final group-stage tiebreaker.",
                },
                {
                  title: "Substitutes",
                  body: "A designated sub covers no-shows. If that sub is unavailable, others may fill in at the same or lower skill. Skill is declared by the dictator in charge.",
                },
                {
                  title: "Admin",
                  body: "Tournament is organized in the AA: Competitive Community Discord.",
                },
              ].map((rule) => (
                <div
                  key={rule.title}
                  className="rounded-lg border border-gray-700 bg-gray-900 p-4"
                >
                  <h4 className="mb-2 font-semibold text-white">{rule.title}</h4>
                  <p className="text-sm text-gray-400">{rule.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
