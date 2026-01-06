"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import TrackerLayout from "../TrackerLayout";

const API_BASE = "https://server-details.ej.workers.dev";

interface TopPlayer {
  player_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio?: number;
  total_games?: number;
}

type TimeRange = "30d" | "7d" | "90d" | "all" | "custom";

const TopPlayersPage = () => {
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"kd" | "kills" | "games">("kills");
  const [limit, setLimit] = useState<number>(50);

  // Time range state - default to 30 days
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [startTime, setStartTime] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Update time range based on preset selection
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    const now = new Date();
    const end = now.toISOString().slice(0, 16);
    setEndTime(end);

    if (range === "7d") {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      setStartTime(start.toISOString().slice(0, 16));
    } else if (range === "30d") {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setStartTime(start.toISOString().slice(0, 16));
    } else if (range === "90d") {
      const start = new Date();
      start.setDate(start.getDate() - 90);
      setStartTime(start.toISOString().slice(0, 16));
    } else if (range === "all") {
      setStartTime("");
    }
    // "custom" keeps current values
  };

  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append("limit", limit.toString());
        
        // Add time range params (only if not "all time")
        if (timeRange !== "all" && startTime) {
          params.append("start_time", new Date(startTime).toISOString());
        }
        if (timeRange !== "all" && endTime) {
          params.append("end_time", new Date(endTime).toISOString());
        }

        const response = await fetch(
          `${API_BASE}/analytics/top-players/${sortBy}?${params.toString()}`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          setTopPlayers(data);
        } else if (data.players && Array.isArray(data.players)) {
          setTopPlayers(data.players);
        } else {
          setTopPlayers([]);
        }
        setError(null);
      } catch (err) {
        console.error("Failed to fetch top players:", err);
        setError("Failed to fetch top players");
        setTopPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopPlayers();
  }, [sortBy, limit, timeRange, startTime, endTime]);

  const calculateKD = (kills: number, deaths: number) => {
    if (deaths === 0) return kills > 0 ? "∞" : "0.00";
    return (kills / deaths).toFixed(2);
  };

  return (
    <TrackerLayout>
      {/* Filters */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        {/* Time Range Quick Buttons */}
        <div className="mb-4">
          <label className="block text-gray-300 text-xs sm:text-sm mb-2">Time Range</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "7d", label: "7 Days" },
              { value: "30d", label: "30 Days" },
              { value: "90d", label: "90 Days" },
              { value: "all", label: "All Time" },
              { value: "custom", label: "Custom" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleTimeRangeChange(option.value as TimeRange)}
                className={`px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                  timeRange === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        {timeRange === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div>
              <label className="block text-gray-300 text-xs sm:text-sm mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-xs sm:text-sm mb-1">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* Sort and Limit */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "kd" | "kills" | "games")}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            >
              <option value="kills">Kills</option>
              <option value="kd">K/D Ratio</option>
              <option value="games">Games</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-300 text-xs sm:text-sm mb-1">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              min="1"
              max="500"
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-white text-center py-12">Loading...</div>}

      {/* Content */}
      {!loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-white text-xs sm:text-sm min-w-[450px]">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Rank</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Player</th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Kills</th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Deaths</th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4">K/D</th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Games</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.length > 0 ? (
                  topPlayers.map((player, index) => (
                    <tr
                      key={player.player_name}
                      className="border-b border-gray-800 hover:bg-gray-800"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-400">#{index + 1}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <Link
                          href={`/tracker/player/${encodeURIComponent(player.player_name)}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-medium truncate block max-w-[120px] sm:max-w-none"
                        >
                          {player.player_name}
                        </Link>
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-green-400">
                        {player.total_kills}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-red-400">
                        {player.total_deaths}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {player.kd_ratio !== undefined
                          ? player.kd_ratio.toFixed(2)
                          : calculateKD(player.total_kills, player.total_deaths)}
                      </td>
                      <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                        {player.total_games || "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No players found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </TrackerLayout>
  );
};

export default TopPlayersPage;
