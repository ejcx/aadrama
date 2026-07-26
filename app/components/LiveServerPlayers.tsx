"use client";

import Link from "next/link";
import {
  calculateFragRate,
  calculateScore,
  type LivePlayer,
  type LiveServerInfo,
} from "@/lib/server-query";

function hasNumber(n: number | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function LiveServerPlayers({ serverInfo }: { serverInfo: LiveServerInfo }) {
  const players = [...serverInfo.player_list].sort((a, b) => b.kills - a.kills);

  return (
    <div className="space-y-4 pt-4">
      <MatchMeta serverInfo={serverInfo} />

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-white text-xs sm:text-sm min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80 text-gray-500">
              <th className="text-left py-2 px-2 sm:px-3 font-medium">Player</th>
              <th className="text-center py-2 px-2 font-medium">Ping</th>
              <th className="text-center py-2 px-2 font-medium">K</th>
              <th className="text-center py-2 px-2 font-medium">D</th>
              <th
                className="text-center py-2 px-2 font-medium"
                title="Rules of engagement (teammate shots)"
              >
                ROE
              </th>
              <th className="text-center py-2 px-2 font-medium">K/D</th>
              <th className="text-center py-2 px-2 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayerRow key={`${player.name}-${index}`} player={player} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-600">
        Mode {serverInfo.game_mode}
        {serverInfo.game_version ? ` · ${serverInfo.game_version}` : ""}
        {" · "}
        Query {serverInfo.ping}
      </p>
    </div>
  );
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
      label: "Goals",
      value: `${serverInfo.goal_team0} – ${serverInfo.goal_team1}`,
    });
  }
  if (serverInfo.leader_team0 != null && serverInfo.leader_team1 != null) {
    bits.push({
      label: "Leader",
      value: `${serverInfo.leader_team0} / ${serverInfo.leader_team1}`,
    });
  }
  if (hasNumber(serverInfo.honor_team0) && hasNumber(serverInfo.honor_team1)) {
    bits.push({
      label: "Honor",
      value: `${serverInfo.honor_team0} / ${serverInfo.honor_team1}`,
    });
  }
  if (serverInfo.roe_team0 != null || serverInfo.roe_team1 != null) {
    bits.push({
      label: "Team ROE",
      value: `${serverInfo.roe_team0 ?? 0} / ${serverInfo.roe_team1 ?? 0}`,
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

function PlayerRow({ player }: { player: LivePlayer }) {
  const frag = calculateFragRate(player.kills, player.deaths);
  const score = calculateScore(player.kills, player.deaths);
  const roe = player.roe ?? 0;

  return (
    <tr className="border-b border-gray-800/80 hover:bg-white/[0.02]">
      <td className="py-2 px-2 sm:px-3">
        <Link
          href={`/tracker/player/${encodeURIComponent(player.name)}`}
          className="font-medium text-cyan-400/90 hover:text-cyan-300 truncate block max-w-[140px] sm:max-w-none"
        >
          <span className="text-gray-600 font-normal">[{player.honor}]</span> {player.name}
        </Link>
      </td>
      <td className="text-center py-2 px-2">
        <span
          className={`font-mono tabular-nums text-xs ${
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
      <td className="text-center py-2 px-2 text-emerald-400/90 font-mono tabular-nums">
        {player.kills}
      </td>
      <td className="text-center py-2 px-2 text-red-400/80 font-mono tabular-nums">
        {player.deaths}
      </td>
      <td
        className={`text-center py-2 px-2 font-mono tabular-nums ${
          roe > 0 ? "text-amber-400 font-semibold" : "text-gray-700"
        }`}
      >
        {roe}
      </td>
      <td className="text-center py-2 px-2 text-gray-300 font-mono tabular-nums">{frag}</td>
      <td
        className={`text-center py-2 px-2 font-mono tabular-nums ${
          score > 0 ? "text-emerald-400/80" : score < 0 ? "text-red-400/80" : "text-gray-600"
        }`}
      >
        {score}
      </td>
    </tr>
  );
}
