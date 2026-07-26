"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getKothLeaderboard } from "@/app/koth/actions";
import { formatLabel, type KothFormat } from "@/lib/koth/format";
import type { KothTeam } from "@/lib/supabase/types";

export default function KothLeaderboardClient({
  initialFormat,
  initialTeams,
}: {
  initialFormat: KothFormat;
  initialTeams: KothTeam[];
}) {
  const [format, setFormat] = useState<KothFormat>(initialFormat);
  const [teams, setTeams] = useState<KothTeam[]>(initialTeams);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (format === initialFormat) {
      setTeams(initialTeams);
      return;
    }
    startTransition(async () => {
      try {
        const data = await getKothLeaderboard(format);
        setTeams(data);
      } catch (err) {
        console.error("Failed to load KotH leaderboard:", err);
        setTeams([]);
      }
    });
  }, [format, initialFormat, initialTeams]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-gray-400 text-sm">
          Team ELO by format. Same roster shares a rating; play matches on{" "}
          <Link href="/koth" className="text-blue-400 hover:underline">
            King of the Hill
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as KothFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                format === f
                  ? "bg-amber-700 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600"
              }`}
            >
              {formatLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold">{formatLabel(format)} Team Rankings</h2>
          {isPending && <span className="text-gray-500 text-xs">Loading…</span>}
        </div>

        {teams.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No ranked {formatLabel(format)} teams yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Roster</th>
                  <th className="px-4 py-3 text-right">ELO</th>
                  <th className="px-4 py-3 text-right">W-L-D</th>
                  <th className="px-4 py-3 text-right">Games</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => (
                  <tr key={team.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{team.name}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {(team.member_names || []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-mono font-semibold">
                      {team.elo}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {team.wins}-{team.losses}-{team.draws}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{team.games_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
