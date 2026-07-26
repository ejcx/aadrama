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
          <Link href="/koth" className="aa-link hover:underline">
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
              className={format === f ? "aa-chip-active !px-3.5 !py-2 !text-sm" : "aa-chip !px-3.5 !py-2 !text-sm"}
            >
              {formatLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="aa-table-wrap">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{formatLabel(format)} Team Rankings</h2>
          {isPending && <span className="text-gray-500 text-xs">Loading…</span>}
        </div>

        {teams.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No ranked {formatLabel(format)} teams yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Roster</th>
                  <th className="px-4 py-3 text-right font-medium">ELO</th>
                  <th className="px-4 py-3 text-right font-medium">W-L-D</th>
                  <th className="px-4 py-3 text-right font-medium">Games</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => (
                  <tr key={team.id} className="border-b border-gray-800/80 hover:bg-white/[0.02]">
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
