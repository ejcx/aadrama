"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TEAMS,
  aggregatePlayerStats,
  recordedMapNames,
  type PlayerStatLine,
} from "@/lib/tournaments/fall-2026";

function formatFrag(n: number) {
  return n.toFixed(2);
}

export default function PlayerStatsTable({ lines }: { lines: PlayerStatLine[] }) {
  const [teamId, setTeamId] = useState("all");
  const [mapName, setMapName] = useState("all");

  const maps = recordedMapNames();
  const teamOptions = TEAMS.filter((team) =>
    lines.some((line) => line.teamId === team.id && line.kills + line.deaths > 0)
  );

  const stats = useMemo(() => {
    const filtered = lines.filter((line) => {
      if (teamId !== "all" && line.teamId !== teamId) return false;
      if (mapName !== "all" && line.mapName !== mapName) return false;
      return true;
    });
    return aggregatePlayerStats(filtered);
  }, [lines, teamId, mapName]);

  const chip = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-cyan-500/20 text-cyan-200"
        : "bg-gray-800 text-gray-400 hover:text-gray-200"
    }`;

  return (
    <div className="w-full">
      <h3 className="mb-2 text-xl font-bold text-white sm:text-2xl">
        Player stats
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        Combined kills, deaths, and frag rate from recorded match sessions.
        Spectators with 0/0 are omitted.
      </p>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(teamId === "all")}
            onClick={() => setTeamId("all")}
          >
            All teams
          </button>
          {teamOptions.map((team) => (
            <button
              key={team.id}
              type="button"
              className={chip(teamId === team.id)}
              onClick={() => setTeamId(team.id)}
            >
              {team.shortName ?? team.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(mapName === "all")}
            onClick={() => setMapName("all")}
          >
            All maps
          </button>
          {maps.map((map) => (
            <button
              key={map}
              type="button"
              className={chip(mapName === map)}
              onClick={() => setMapName(map)}
            >
              {map}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-400">
                <th className="px-3 py-3 text-left">#</th>
                <th className="px-3 py-3 text-left">Player</th>
                <th className="px-3 py-3 text-left">Team</th>
                <th className="px-3 py-3 text-center">K</th>
                <th className="px-3 py-3 text-center">D</th>
                <th className="px-3 py-3 text-right">Frag</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-gray-500"
                  >
                    No players for this filter.
                  </td>
                </tr>
              ) : (
                stats.map((row, idx) => {
                  const team = TEAMS.find((t) => t.id === row.teamId);
                  return (
                    <tr
                      key={`${row.trackerName}-${row.teamId ?? "none"}`}
                      className="border-b border-gray-800/60"
                    >
                      <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/tracker/player/${encodeURIComponent(row.trackerName)}`}
                          className="font-medium text-gray-200 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2 text-gray-400">
                          {team && (
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${team.color}`}
                            />
                          )}
                          {row.teamName ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-200">
                        {row.kills}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-400">
                        {row.deaths}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                          row.fragRate >= 1 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {formatFrag(row.fragRate)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
