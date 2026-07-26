"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SidebarLayout from "../../components/SidebarLayout";
import { getKothMatch, getKothMatchPlayers } from "../actions";
import { formatLabel, type KothFormat } from "@/lib/koth/format";
import type { KothMatchWithCounts, KothMatchPlayer } from "@/lib/supabase/types";

export default function KothDetailClient() {
  const params = useParams();
  const id = params?.id as string;
  const [match, setMatch] = useState<KothMatchWithCounts | null>(null);
  const [players, setPlayers] = useState<KothMatchPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getKothMatch(id), getKothMatchPlayers(id)])
      .then(([m, p]) => {
        setMatch(m);
        setPlayers(p);
        if (!m) setError("Match not found");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  return (
    <SidebarLayout>
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <Link href="/koth" className="text-blue-400 text-sm hover:underline">
            ← Back to King of the Hill
          </Link>

          {error && <div className="text-red-400">{error}</div>}
          {!error && !match && <div className="text-gray-400">Loading…</div>}

          {match && (
            <>
              <h1 className="text-2xl font-bold text-white">
                {match.team_a_name}{" "}
                <span className="text-gray-500">vs</span> {match.team_b_name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-amber-400 font-semibold">
                  {formatLabel(match.format as KothFormat)}
                </span>
                <span className="text-cyan-400">{match.map}</span>
                <span className="text-gray-400 capitalize">{match.status.replace("_", " ")}</span>
              </div>

              {match.team_a_score != null && match.team_b_score != null && (
                <p className="text-3xl font-mono text-green-400">
                  {match.team_a_score} – {match.team_b_score}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["team_a", "team_b"] as const).map((side) => (
                  <div
                    key={side}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                  >
                    <h2 className="text-white font-semibold mb-2">
                      {side === "team_a" ? match.team_a_name : match.team_b_name}
                    </h2>
                    <ul className="space-y-1">
                      {players
                        .filter((p) => p.team === side)
                        .map((p) => (
                          <li key={p.id} className="text-gray-300 text-sm">
                            {p.user_name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="text-gray-500 text-sm">
                Created by {match.created_by_name || "Unknown"} ·{" "}
                {new Date(match.created_at).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
