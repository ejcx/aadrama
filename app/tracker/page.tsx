"use client";
import { useState, useEffect } from "react";
import SidebarLayout from "../components/SidebarLayout";
import Link from "next/link";

const API_BASE = "https://server-details.ej.workers.dev";

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  server_ip?: string;
  map?: string;
  peak_players?: number;
}

interface TopPlayer {
  player_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio?: number;
  total_games?: number;
}

interface MapInfo {
  map_name: string;
  game_count: number;
}

type ViewMode = "recent-sessions" | "all-sessions" | "top-players" | "players-by-map";

const Tracker = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("recent-sessions");
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topPlayersByMap, setTopPlayersByMap] = useState<{ map: string; players: TopPlayer[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Time picker state
  const [startTime, setStartTime] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });
  const [selectedMap, setSelectedMap] = useState<string>("");
  const [selectedServerIp, setSelectedServerIp] = useState<string>("");
  const [sortBy, setSortBy] = useState<"kd" | "kills" | "games">("kills");
  const [limit, setLimit] = useState<number>(50);
  
  // Maps list
  const [maps, setMaps] = useState<MapInfo[]>([]);

  // Fetch recent sessions
  useEffect(() => {
    const fetchRecentSessions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/sessions?limit=20`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setRecentSessions(data);
        } else if (data.sessions && Array.isArray(data.sessions)) {
          setRecentSessions(data.sessions);
        } else {
          setRecentSessions([]);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch recent sessions:', err);
        setError('Failed to fetch recent sessions');
        setRecentSessions([]);
      } finally {
        setLoading(false);
      }
    };

    if (viewMode === "recent-sessions") {
      fetchRecentSessions();
    }
  }, [viewMode]);

  // Fetch all sessions with filters
  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (startTime) {
          params.append('start_time', new Date(startTime).toISOString());
        }
        if (endTime) {
          params.append('end_time', new Date(endTime).toISOString());
        }
        if (selectedMap) {
          params.append('map', selectedMap);
        }
        if (selectedServerIp) {
          params.append('server_ip', selectedServerIp);
        }
        params.append('limit', limit.toString());
        
        const response = await fetch(`${API_BASE}/sessions?${params.toString()}`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setAllSessions(data);
        } else if (data.sessions && Array.isArray(data.sessions)) {
          setAllSessions(data.sessions);
        } else {
          setAllSessions([]);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError('Failed to fetch sessions');
        setAllSessions([]);
      } finally {
        setLoading(false);
      }
    };

    if (viewMode === "all-sessions") {
      fetchAllSessions();
    }
  }, [viewMode, startTime, endTime, selectedMap, selectedServerIp, limit]);

  // Fetch top players
  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        
        const response = await fetch(`${API_BASE}/analytics/top-players/${sortBy}?${params.toString()}`);
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
        console.error('Failed to fetch top players:', err);
        setError('Failed to fetch top players');
        setTopPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    if (viewMode === "top-players") {
      fetchTopPlayers();
    }
  }, [viewMode, sortBy, limit]);

  // Fetch maps
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const response = await fetch(`${API_BASE}/analytics/maps`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setMaps(data);
        } else if (data.maps && Array.isArray(data.maps)) {
          setMaps(data.maps);
        }
      } catch (err) {
        console.error('Failed to fetch maps:', err);
      }
    };

    fetchMaps();
  }, []);

  // Fetch top players by map
  useEffect(() => {
    const fetchTopPlayersByMap = async () => {
      try {
        setLoading(true);
        if (!selectedMap) {
          setTopPlayersByMap([]);
          setLoading(false);
          return;
        }
        
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('sort_by', sortBy);
        
        const response = await fetch(`${API_BASE}/analytics/top-players/map/${encodeURIComponent(selectedMap)}?${params.toString()}`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setTopPlayersByMap([{ map: selectedMap, players: data }]);
        } else if (data.players && Array.isArray(data.players)) {
          setTopPlayersByMap([{ map: selectedMap, players: data.players }]);
        } else {
          setTopPlayersByMap([]);
        }
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch top players by map:', err);
        setError('Failed to fetch top players by map');
        setTopPlayersByMap([]);
      } finally {
        setLoading(false);
      }
    };

    if (viewMode === "players-by-map") {
      fetchTopPlayersByMap();
    }
  }, [viewMode, selectedMap, sortBy, limit]);

  const formatDate = (dateString: string) => {
    try {
      // Handle both ISO format and space-separated format
      let dateStr = dateString;
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        // Convert "2025-11-20 10:28:46.003247" to ISO format
        dateStr = dateStr.replace(' ', 'T');
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
          dateStr += 'Z';
        }
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const calculateKD = (kills: number, deaths: number) => {
    if (deaths === 0) return kills > 0 ? '∞' : '0.00';
    return (kills / deaths).toFixed(2);
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col px-8 py-12">
        <div className="max-w-6xl w-full mx-auto">
          <h1 className="text-white text-3xl font-bold mb-8">Tracker</h1>

          {/* View Mode Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700">
            <button
              onClick={() => setViewMode("recent-sessions")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                viewMode === "recent-sessions"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Recent Sessions
            </button>
            <button
              onClick={() => setViewMode("all-sessions")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                viewMode === "all-sessions"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Browse Sessions
            </button>
            <button
              onClick={() => setViewMode("top-players")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                viewMode === "top-players"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Top Players
            </button>
            <button
              onClick={() => setViewMode("players-by-map")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                viewMode === "players-by-map"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Top Players by Map
            </button>
          </div>

          {/* Filters for all-sessions */}
          {viewMode === "all-sessions" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Map</label>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">All Maps</option>
                    {maps.map((map, index) => (
                      <option key={`${map.map_name}-${index}`} value={map.map_name}>
                        {map.map_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Limit</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                    min="1"
                    max="500"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filters for top-players */}
          {viewMode === "top-players" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "kd" | "kills" | "games")}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="kills">Kills</option>
                    <option value="kd">K/D Ratio</option>
                    <option value="games">Games</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Limit</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                    min="1"
                    max="500"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filters for players-by-map */}
          {viewMode === "players-by-map" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Map</label>
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select a map</option>
                    {maps.map((map, index) => (
                      <option key={`${map.map_name}-${index}`} value={map.map_name}>
                        {map.map_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "kd" | "kills" | "games")}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="kills">Kills</option>
                    <option value="kd">K/D Ratio</option>
                    <option value="games">Games</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Limit</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                    min="1"
                    max="500"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-white text-center py-12">Loading...</div>
          )}

          {!loading && viewMode === "recent-sessions" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-white text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800">
                      <th className="text-left py-3 px-4">Session ID</th>
                      <th className="text-left py-3 px-4">Start Time</th>
                      <th className="text-left py-3 px-4">Map</th>
                      <th className="text-left py-3 px-4">Server IP</th>
                      <th className="text-center py-3 px-4">Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.length > 0 ? (
                      recentSessions.map((session) => (
                        <tr
                          key={session.session_id}
                          className="border-b border-gray-800 hover:bg-gray-800"
                        >
                          <td className="py-3 px-4">
                            <Link
                              href={`/tracker/session/${session.session_id}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs"
                            >
                              {session.session_id}
                            </Link>
                          </td>
                          <td className="py-3 px-4">{formatDate(session.time_started)}</td>
                          <td className="py-3 px-4">{session.map || "N/A"}</td>
                          <td className="py-3 px-4 font-mono text-xs">{session.server_ip || "N/A"}</td>
                          <td className="text-center py-3 px-4">{session.peak_players || "N/A"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">
                          No sessions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && viewMode === "all-sessions" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-white text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800">
                      <th className="text-left py-3 px-4">Session ID</th>
                      <th className="text-left py-3 px-4">Start Time</th>
                      <th className="text-left py-3 px-4">End Time</th>
                      <th className="text-left py-3 px-4">Map</th>
                      <th className="text-left py-3 px-4">Server IP</th>
                      <th className="text-center py-3 px-4">Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSessions.length > 0 ? (
                      allSessions.map((session) => (
                        <tr
                          key={session.session_id}
                          className="border-b border-gray-800 hover:bg-gray-800"
                        >
                          <td className="py-3 px-4">
                            <Link
                              href={`/tracker/session/${session.session_id}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs"
                            >
                              {session.session_id}
                            </Link>
                          </td>
                          <td className="py-3 px-4">{formatDate(session.time_started)}</td>
                          <td className="py-3 px-4">{session.time_finished ? formatDate(session.time_finished) : "Active"}</td>
                          <td className="py-3 px-4">{session.map || "N/A"}</td>
                          <td className="py-3 px-4 font-mono text-xs">{session.server_ip || "N/A"}</td>
                          <td className="text-center py-3 px-4">{session.peak_players || "N/A"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          No sessions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && viewMode === "top-players" && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-white text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800">
                      <th className="text-left py-3 px-4">Rank</th>
                      <th className="text-left py-3 px-4">Player</th>
                      <th className="text-center py-3 px-4">Kills</th>
                      <th className="text-center py-3 px-4">Deaths</th>
                      <th className="text-center py-3 px-4">K/D</th>
                      <th className="text-center py-3 px-4">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.length > 0 ? (
                      topPlayers.map((player, index) => (
                        <tr
                          key={player.player_name}
                          className="border-b border-gray-800 hover:bg-gray-800"
                        >
                          <td className="py-3 px-4 text-gray-400">#{index + 1}</td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/tracker/player/${encodeURIComponent(player.player_name)}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                            >
                              {player.player_name}
                            </Link>
                          </td>
                          <td className="text-center py-3 px-4 text-green-400">{player.total_kills}</td>
                          <td className="text-center py-3 px-4 text-red-400">{player.total_deaths}</td>
                          <td className="text-center py-3 px-4">
                            {player.kd_ratio !== undefined
                              ? player.kd_ratio.toFixed(2)
                              : calculateKD(player.total_kills, player.total_deaths)}
                          </td>
                          <td className="text-center py-3 px-4">{player.total_games || "N/A"}</td>
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

          {!loading && viewMode === "players-by-map" && (
            <div>
              {selectedMap ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="text-white text-xl font-bold">Top Players - {selectedMap}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-white text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 bg-gray-800">
                          <th className="text-left py-3 px-4">Rank</th>
                          <th className="text-left py-3 px-4">Player</th>
                          <th className="text-center py-3 px-4">Kills</th>
                          <th className="text-center py-3 px-4">Deaths</th>
                          <th className="text-center py-3 px-4">K/D</th>
                          <th className="text-center py-3 px-4">Games</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPlayersByMap.length > 0 && topPlayersByMap[0].players.length > 0 ? (
                          topPlayersByMap[0].players.map((player, index) => (
                            <tr
                              key={player.player_name}
                              className="border-b border-gray-800 hover:bg-gray-800"
                            >
                              <td className="py-3 px-4 text-gray-400">#{index + 1}</td>
                              <td className="py-3 px-4">
                                <Link
                                  href={`/tracker/player/${encodeURIComponent(player.player_name)}`}
                                  className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                                >
                                  {player.player_name}
                                </Link>
                              </td>
                              <td className="text-center py-3 px-4 text-green-400">{player.total_kills}</td>
                              <td className="text-center py-3 px-4 text-red-400">{player.total_deaths}</td>
                              <td className="text-center py-3 px-4">
                                {player.kd_ratio !== undefined
                                  ? player.kd_ratio.toFixed(2)
                                  : calculateKD(player.total_kills, player.total_deaths)}
                              </td>
                              <td className="text-center py-3 px-4">{player.total_games || "N/A"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-400">
                              No players found for this map
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
                  Please select a map to view top players
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Tracker;

