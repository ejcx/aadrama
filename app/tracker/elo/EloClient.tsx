"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { SEASON_2_LABEL } from "@/lib/scrim/seasons";
import {
  getEloLeaderboard,
  getEloChanges7Days,
  getSeason2EloLeaderboard,
  getSeason2EloChanges7Days,
  getRankedScrimMaps,
  getPlayerStatsByMap,
  type MapPlayerStats,
} from "../actions";

type SeasonView = "all" | "season2";

interface EloPlayer {
  game_name: string;
  game_name_lower: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  eloChange7Days: number;
  recentMatches: number;
  total_kills: number;
  total_deaths: number;
  kd_ratio: number;
}

interface InitialData {
  eloPlayers: EloPlayer[];
  maps: string[];
}

async function buildEloPlayers(
  records: Awaited<ReturnType<typeof getEloLeaderboard>>,
  fetchChanges: (names: string[]) => Promise<{ game_name_lower: string; elo_change: number }[]>
): Promise<EloPlayer[]> {
  const gameNames = records.map((p) => p.game_name_lower);
  const historyRecords = gameNames.length > 0 ? await fetchChanges(gameNames) : [];

  const changeMap = new Map<string, { change: number; matches: number }>();
  for (const record of historyRecords) {
    const existing = changeMap.get(record.game_name_lower) || { change: 0, matches: 0 };
    changeMap.set(record.game_name_lower, {
      change: existing.change + record.elo_change,
      matches: existing.matches + 1,
    });
  }

  return records.map((p) => ({
    game_name: p.game_name,
    game_name_lower: p.game_name_lower,
    elo: p.elo,
    games_played: p.games_played,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    eloChange7Days: changeMap.get(p.game_name_lower)?.change || 0,
    recentMatches: changeMap.get(p.game_name_lower)?.matches || 0,
    total_kills: p.total_kills,
    total_deaths: p.total_deaths,
    kd_ratio: p.kd_ratio,
  }));
}

export default function EloClient({ initialData }: { initialData: InitialData }) {
  const [seasonView, setSeasonView] = useState<SeasonView>("all");
  const [selectedMap, setSelectedMap] = useState<string>("");
  const [maps, setMaps] = useState<string[]>(initialData.maps);
  const [eloPlayers, setEloPlayers] = useState<EloPlayer[]>(initialData.eloPlayers);
  const [mapStats, setMapStats] = useState<MapPlayerStats[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const switchSeason = (view: SeasonView) => {
    if (view === seasonView) return;
    setSeasonView(view);
    setSelectedMap("");
    setMapStats(null);
    setSeasonLoading(true);

    startTransition(async () => {
      try {
        const [records, mapList] = await Promise.all([
          view === "season2" ? getSeason2EloLeaderboard(100) : getEloLeaderboard(100),
          getRankedScrimMaps({ season2: view === "season2" }),
        ]);
        const players = await buildEloPlayers(
          records,
          view === "season2" ? getSeason2EloChanges7Days : getEloChanges7Days
        );
        setEloPlayers(players);
        setMaps(mapList);
      } catch (err) {
        console.error("Failed to load season leaderboard:", err);
      } finally {
        setSeasonLoading(false);
      }
    });
  };

  // Load map stats when map is selected
  useEffect(() => {
    if (!selectedMap) {
      setMapStats(null);
      return;
    }

    setLoading(true);
    getPlayerStatsByMap(selectedMap, { season2: seasonView === "season2" })
      .then((stats) => {
        setMapStats(stats);
      })
      .catch((err) => {
        console.error("Failed to load map stats:", err);
        setMapStats([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedMap, seasonView]);

  const tableLoading = loading || seasonLoading || isPending;

  return (
    <div className="space-y-4">
      {/* Season toggle */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-gray-300 text-sm font-medium">Leaderboard:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchSeason("all")}
              disabled={tableLoading}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                seasonView === "all"
                  ? "bg-white text-black"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              All time
            </button>
            <button
              type="button"
              onClick={() => switchSeason("season2")}
              disabled={tableLoading}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                seasonView === "season2"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {SEASON_2_LABEL}
            </button>
          </div>
          {seasonView === "season2" && (
            <span className="text-purple-300 text-sm">
              Ranked games since May 16, 2026 · fresh ELO from 1200
            </span>
          )}
        </div>
      </div>

      {/* Map Filter */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-gray-300 text-sm font-medium">Filter by Map:</label>
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="flex-1 max-w-xs px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
          >
            <option value="">All Maps (Overall ELO)</option>
            {maps.map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
          {selectedMap && (
            <span className="text-cyan-400 text-sm">
              🗺️ Showing stats for {selectedMap}
            </span>
          )}
        </div>
        {selectedMap && (
          <p className="text-gray-400 text-xs mt-2">
            Note: Map ELO is calculated as 1200 + sum of all ELO changes from scrims on this map.
          </p>
        )}
      </div>

      {/* Loading State */}
      {tableLoading && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          {seasonLoading || isPending ? "Loading leaderboard..." : "Loading map statistics..."}
        </div>
      )}

      {/* Map-Specific Stats Table */}
      {!tableLoading && selectedMap && mapStats && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          {mapStats.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No ranked games found on {selectedMap}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-white text-xs sm:text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Rank</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Player</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Map ELO</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Games</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">W-L-D</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {mapStats.map((player, index) => (
                    <tr
                      key={player.game_name_lower}
                      className="border-b border-gray-800 hover:bg-gray-800"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <span
                          className={`font-bold ${
                            index === 0
                              ? "text-yellow-400"
                              : index === 1
                              ? "text-gray-300"
                              : index === 2
                              ? "text-orange-400"
                              : "text-gray-500"
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <Link
                          href={`/tracker/player/${encodeURIComponent(player.game_name)}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                        >
                          {player.game_name}
                        </Link>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-yellow-400 font-bold text-base">
                          {player.map_elo}
                        </span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300">
                        {player.games_played}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-green-400">{player.wins}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-red-400">{player.losses}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-gray-400">{player.draws}</span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {player.games_played > 0 ? (
                          <span
                            className={`font-medium ${
                              player.wins / player.games_played >= 0.5
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {((player.wins / player.games_played) * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-500">─</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Overall ELO Table (when no map selected) */}
      {!tableLoading && !selectedMap && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          {eloPlayers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {seasonView === "season2"
                ? "No Season 2 ranked games yet. Play some scrims to get on the leaderboard!"
                : "No ranked players yet. Play some scrims to get on the leaderboard!"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-white text-xs sm:text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Rank</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Player</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">ELO</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">7d Change</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Games</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">W-L-D</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Win%</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Scrim Kills</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Scrim Deaths</th>
                    <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Scrim K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {eloPlayers.map((player, index) => (
                    <tr
                      key={player.game_name_lower}
                      className="border-b border-gray-800 hover:bg-gray-800"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <span
                          className={`font-bold ${
                            index === 0
                              ? "text-yellow-400"
                              : index === 1
                              ? "text-gray-300"
                              : index === 2
                              ? "text-orange-400"
                              : "text-gray-500"
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <Link
                          href={`/tracker/player/${encodeURIComponent(player.game_name)}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                        >
                          {player.game_name}
                        </Link>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-yellow-400 font-bold text-base">
                          {player.elo}
                        </span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {player.eloChange7Days !== 0 ? (
                          <span
                            className={`font-semibold ${
                              player.eloChange7Days > 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {player.eloChange7Days > 0 ? "▲" : "▼"}{" "}
                            {player.eloChange7Days > 0 ? "+" : ""}
                            {player.eloChange7Days}
                          </span>
                        ) : (
                          <span className="text-gray-500">─</span>
                        )}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300">
                        {player.games_played}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-green-400">{player.wins}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-red-400">{player.losses}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-gray-400">{player.draws}</span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {player.games_played > 0 ? (
                          <span
                            className={`font-medium ${
                              player.wins / player.games_played >= 0.5
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {((player.wins / player.games_played) * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-500">─</span>
                        )}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-cyan-400 font-medium">
                          {player.total_kills.toLocaleString()}
                        </span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span className="text-red-300">
                          {player.total_deaths.toLocaleString()}
                        </span>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        <span
                          className={`font-bold ${
                            player.kd_ratio >= 1.5
                              ? "text-green-400"
                              : player.kd_ratio >= 1.0
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {player.kd_ratio === 999.99 ? "∞" : player.kd_ratio.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
