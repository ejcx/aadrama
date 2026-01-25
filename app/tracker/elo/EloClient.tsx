"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getEloLeaderboard,
  getEloChanges7Days,
  getRankedScrimMaps,
  getPlayerStatsByMap,
  type MapPlayerStats,
} from "../actions";

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

export default function EloClient({ initialData }: { initialData: InitialData }) {
  const [selectedMap, setSelectedMap] = useState<string>("");
  const [maps, setMaps] = useState<string[]>(initialData.maps);
  const [eloPlayers, setEloPlayers] = useState<EloPlayer[]>(initialData.eloPlayers);
  const [mapStats, setMapStats] = useState<MapPlayerStats[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Load map stats when map is selected
  useEffect(() => {
    if (!selectedMap) {
      setMapStats(null);
      return;
    }

    setLoading(true);
    getPlayerStatsByMap(selectedMap)
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
  }, [selectedMap]);

  const displayData = selectedMap && mapStats ? mapStats : null;

  return (
    <div className="space-y-4">
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
      {loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          Loading map statistics...
        </div>
      )}

      {/* Map-Specific Stats Table */}
      {!loading && selectedMap && mapStats && (
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
      {!loading && !selectedMap && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          {eloPlayers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No ranked players yet. Play some scrims to get on the leaderboard!
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
