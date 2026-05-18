"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import RankedPlayerPicker from "@/app/components/RankedPlayerPicker";
import { SEASON_2_LABEL } from "@/lib/scrim/seasons";
import {
  getRankedScrimMaps,
  getTeammateStats,
  type TeammateStatsResult,
} from "../actions";

type SeasonView = "all" | "season2";
type TeammateMode = "with" | "without";

type ComparisonRow = {
  id: string;
  subject: string;
  subjectDisplay: string;
  teammate: string;
  teammateDisplay: string;
  mode: TeammateMode;
  map: string;
};

function newRow(partial?: Partial<ComparisonRow>): ComparisonRow {
  return {
    id: crypto.randomUUID(),
    subject: "",
    subjectDisplay: "",
    teammate: "",
    teammateDisplay: "",
    mode: "with",
    map: "",
    ...partial,
  };
}

export default function TeammateStatsClient({
  initialMaps,
}: {
  initialMaps: string[];
}) {
  const [seasonView, setSeasonView] = useState<SeasonView>("all");
  const [maps, setMaps] = useState<string[]>(initialMaps);
  const [rows, setRows] = useState<ComparisonRow[]>(() => [newRow()]);
  const [stats, setStats] = useState<TeammateStatsResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRankedScrimMaps({ season2: seasonView === "season2" })
      .then(setMaps)
      .catch(() => setMaps([]));
  }, [seasonView]);

  const loadStats = useCallback(() => {
    const valid = rows.filter((r) => r.subject && r.teammate);
    if (valid.length === 0) {
      setStats([]);
      setError(null);
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const results = await getTeammateStats(
          valid.map((r) => ({
            subject: r.subject,
            teammate: r.teammate,
            mode: r.mode,
            map: r.map || undefined,
          })),
          { season2: seasonView === "season2" }
        );
        setStats(results);
      } catch (err) {
        console.error(err);
        setError("Failed to load teammate stats");
        setStats([]);
      }
    });
  }, [rows, seasonView]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const updateRow = (id: string, patch: Partial<ComparisonRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const hasValidRows = rows.some((r) => r.subject && r.teammate);

  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm max-w-2xl">
        Compare win rates for any ranked player when paired with (or without) another
        player on their team. Each row can use a different map, or all maps. Pick from
        the dropdown or type a name and press Enter. Stats use ranked scrims in{" "}
        <span className="text-gray-300">elo_history</span> (same scrim + same result =
        teammates).
      </p>

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-500 text-sm">Season:</span>
          <button
            type="button"
            onClick={() => setSeasonView("all")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              seasonView === "all"
                ? "bg-white text-gray-900"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All time
          </button>
          <button
            type="button"
            onClick={() => setSeasonView("season2")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              seasonView === "season2"
                ? "bg-cyan-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {SEASON_2_LABEL}
          </button>
          {isPending && (
            <span className="text-gray-500 text-sm ml-2">Updating…</span>
          )}
        </div>

      </div>

      <div className="space-y-3">
        <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_100px_minmax(140px,1fr)_40px] gap-2 text-xs text-gray-500 uppercase tracking-wide px-1">
          <span>Player</span>
          <span>Teammate</span>
          <span>Filter</span>
          <span>Map</span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_minmax(140px,1fr)_40px] gap-2 items-start bg-gray-800/50 border border-gray-700 rounded-lg p-3"
          >
            <RankedPlayerPicker
              value={row.subject}
              displayValue={row.subjectDisplay}
              onChange={(lower, display) =>
                updateRow(row.id, {
                  subject: lower,
                  subjectDisplay: display,
                })
              }
              placeholder="Player…"
            />
            <RankedPlayerPicker
              value={row.teammate}
              displayValue={row.teammateDisplay}
              onChange={(lower, display) =>
                updateRow(row.id, {
                  teammate: lower,
                  teammateDisplay: display,
                })
              }
              placeholder="Teammate…"
            />
            <select
              value={row.mode}
              onChange={(e) =>
                updateRow(row.id, { mode: e.target.value as TeammateMode })
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="with">With</option>
              <option value="without">Without</option>
            </select>
            <select
              value={row.map}
              onChange={(e) => updateRow(row.id, { map: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">All maps</option>
              {maps.map((map) => (
                <option key={map} value={map}>
                  {map}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={rows.length <= 1}
              className="h-[38px] w-full sm:w-10 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Remove row"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
        >
          + Add comparison
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {stats.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Comparison</th>
                <th className="px-4 py-3 font-medium text-center">W</th>
                <th className="px-4 py-3 font-medium text-center">L</th>
                <th className="px-4 py-3 font-medium text-center">D</th>
                <th className="px-4 py-3 font-medium text-center">Games</th>
                <th className="px-4 py-3 font-medium text-center">Rounds ±</th>
                <th className="px-4 py-3 font-medium text-right">Frag</th>
                <th className="px-4 py-3 font-medium text-right">Win %</th>
                <th className="px-4 py-3 font-medium text-right">Round %</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row, i) => (
                <tr
                  key={`${row.label}-${i}`}
                  className="border-t border-gray-700 hover:bg-gray-800/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/tracker/player/${encodeURIComponent(row.subjectDisplay)}`}
                        className="text-cyan-400 hover:underline font-medium"
                      >
                        {row.subjectDisplay}
                      </Link>
                      <span className="text-gray-500">
                        {row.mode === "with" ? "with" : "without"}
                      </span>
                      <Link
                        href={`/tracker/player/${encodeURIComponent(row.teammateDisplay)}`}
                        className="text-cyan-400 hover:underline font-medium"
                      >
                        {row.teammateDisplay}
                      </Link>
                      <span className="text-gray-500">on team</span>
                      {row.map ? (
                        <span className="text-cyan-400/80 text-xs">· {row.map}</span>
                      ) : (
                        <span className="text-gray-500 text-xs">· all maps</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-green-400 tabular-nums">
                    {row.wins}
                  </td>
                  <td className="px-4 py-3 text-center text-red-400 tabular-nums">
                    {row.losses}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400 tabular-nums">
                    {row.draws}
                  </td>
                  <td className="px-4 py-3 text-center text-white tabular-nums">
                    {row.games}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums whitespace-nowrap">
                    <span className="text-green-400">{row.roundsWon}</span>
                    <span className="text-gray-500 mx-0.5">–</span>
                    <span className="text-red-400">{row.roundsLost}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-amber-300/90 tabular-nums">
                    {row.fragRate != null ? (
                      <>
                        {row.fragRate}
                        <span className="text-gray-500 text-xs ml-1">/game</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                    {row.winPct != null ? `${row.winPct}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums">
                    {row.roundWinPct != null ? `${row.roundWinPct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.length === 0 && !isPending && hasValidRows && (
        <p className="text-gray-500 text-sm">No ranked games match these filters.</p>
      )}
    </div>
  );
}
