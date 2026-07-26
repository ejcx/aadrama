"use client";

import Link from "next/link";
import {
  calculateFragRate,
  type LivePlayer,
  type LiveServerInfo,
} from "@/lib/server-query";

function hasNumber(n: number | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function LiveServerPlayers({ serverInfo }: { serverInfo: LiveServerInfo }) {
  const players = serverInfo.player_list || [];
  const teamIds = [...new Set(players.map((p) => p.team).filter((t) => t != null))] as number[];
  const canSplitTeams = teamIds.length >= 2;

  const sorted = (list: LivePlayer[]) => [...list].sort((a, b) => b.kills - a.kills);

  return (
    <div className="space-y-4 pt-4">
      <MatchMeta serverInfo={serverInfo} />

      {canSplitTeams ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {teamIds
            .sort((a, b) => a - b)
            .map((teamId) => {
              const roster = sorted(players.filter((p) => p.team === teamId));
              return (
                <TeamRoster
                  key={teamId}
                  title={teamLabel(teamId)}
                  teamId={teamId}
                  players={roster}
                  goal={teamId === 0 ? serverInfo.goal_team0 : serverInfo.goal_team1}
                />
              );
            })}
        </div>
      ) : (
        <TeamRoster title="Players" players={sorted(players)} />
      )}

      <p className="text-[11px] text-gray-600">
        Mode {serverInfo.game_mode}
        {serverInfo.game_version ? ` · ${serverInfo.game_version}` : ""}
        {" · "}
        Query {serverInfo.ping}
      </p>
    </div>
  );
}

function teamLabel(teamId: number): string {
  if (teamId === 0) return "Team A";
  if (teamId === 1) return "Team B";
  return `Team ${teamId}`;
}

function MatchMeta({ serverInfo }: { serverInfo: LiveServerInfo }) {
  const bits: { label: string; value: string }[] = [];

  if (serverInfo.current_round) {
    bits.push({ label: "Round", value: serverInfo.current_round });
  }
  if (serverInfo.mission_time) {
    bits.push({ label: "Time", value: serverInfo.mission_time });
  }
  if (serverInfo.tickets) {
    bits.push({ label: "Tickets", value: serverInfo.tickets });
  }
  if (hasNumber(serverInfo.goal_team0) && hasNumber(serverInfo.goal_team1)) {
    bits.push({
      label: "Score",
      value: `${serverInfo.goal_team0} – ${serverInfo.goal_team1}`,
    });
  }

  if (bits.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {bits.map((b) => (
        <div key={b.label} className="flex items-baseline gap-1.5">
          <span className="text-gray-600 uppercase tracking-wide text-[10px]">{b.label}</span>
          <span className="text-gray-200 font-mono tabular-nums">{b.value}</span>
        </div>
      ))}
    </div>
  );
}

function TeamRoster({
  title,
  teamId,
  players,
  goal,
}: {
  title: string;
  teamId?: number;
  players: LivePlayer[];
  goal?: number;
}) {
  const accent =
    teamId === 1
      ? "border-rose-900/40"
      : teamId === 0
        ? "border-sky-900/40"
        : "border-gray-800";

  return (
    <div className={`overflow-hidden rounded-lg border ${accent} bg-gray-950/40`}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {title}
          <span className="ml-2 font-normal normal-case text-gray-600">
            {players.length} player{players.length === 1 ? "" : "s"}
          </span>
        </h3>
        {hasNumber(goal) && (
          <span className="font-mono text-sm tabular-nums text-white">{goal}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-white text-xs sm:text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-gray-800/80 text-gray-600">
              <th className="text-left py-1.5 px-2 sm:px-3 font-medium">Player</th>
              <th className="text-center py-1.5 px-2 font-medium">Ping</th>
              <th className="text-center py-1.5 px-2 font-medium">K</th>
              <th className="text-center py-1.5 px-2 font-medium">D</th>
              <th
                className="text-center py-1.5 px-2 font-medium"
                title="Rules of engagement (teammate shots)"
              >
                ROE
              </th>
              <th className="text-center py-1.5 px-2 font-medium">K/D</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayerRow key={`${player.name}-${index}`} player={player} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({ player }: { player: LivePlayer }) {
  const frag = calculateFragRate(player.kills, player.deaths);
  const roe = player.roe ?? 0;

  return (
    <tr className="border-b border-gray-800/60 hover:bg-white/[0.02]">
      <td className="py-1.5 px-2 sm:px-3">
        <Link
          href={`/tracker/player/${encodeURIComponent(player.name)}`}
          className="block max-w-[140px] truncate font-medium text-cyan-400/90 hover:text-cyan-300 sm:max-w-none"
        >
          <span className="font-normal text-gray-600">[{player.honor}]</span> {player.name}
        </Link>
      </td>
      <td className="text-center py-1.5 px-2">
        <span
          className={`font-mono text-xs tabular-nums ${
            player.ping < 50
              ? "text-emerald-400"
              : player.ping < 100
                ? "text-yellow-400"
                : player.ping < 150
                  ? "text-orange-400"
                  : "text-red-400"
          }`}
        >
          {player.ping}
        </span>
      </td>
      <td className="text-center py-1.5 px-2 font-mono tabular-nums text-emerald-400/90">
        {player.kills}
      </td>
      <td className="text-center py-1.5 px-2 font-mono tabular-nums text-red-400/80">
        {player.deaths}
      </td>
      <td
        className={`text-center py-1.5 px-2 font-mono tabular-nums ${
          roe > 0 ? "font-semibold text-amber-400" : "text-gray-700"
        }`}
      >
        {roe}
      </td>
      <td className="text-center py-1.5 px-2 font-mono tabular-nums text-gray-300">{frag}</td>
    </tr>
  );
}
