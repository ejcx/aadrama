"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SidebarLayout from "../../../components/SidebarLayout";
import Link from "next/link";
import { SessionHoverPopover } from "../../../components/SessionHoverPopover";

const API_BASE = "https://server-details.ej.workers.dev";

interface PlayerStats {
  player_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio: number;
  total_games: number;
  total_time_played?: number;
}

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  map?: string;
  server_ip?: string;
  peak_players?: number;
}

interface MapStats {
  player_name: string;
  map_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio: number;
  total_sessions: number;
}

// Helper to get default dates (last 30 days)
const getDefaultDates = () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  const formatForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    start: formatForInput(thirtyDaysAgo),
    end: formatForInput(now)
  };
};

const PlayerDetailClient = () => {
  const params = useParams();
  const playerName = decodeURIComponent(params.name as string);
  
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mapStats, setMapStats] = useState<MapStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [mapStatsLoading, setMapStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session selection state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Time filter for sessions with defaults
  const defaultDates = getDefaultDates();
  const [startTime, setStartTime] = useState<string>(defaultDates.start);
  const [endTime, setEndTime] = useState<string>(defaultDates.end);
  const [limit, setLimit] = useState<number>(25);

  // Toggle session selection
  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Select all visible sessions
  const selectAll = () => {
    setSelectedSessions(new Set(sessions.map((s) => s.session_id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSessions(new Set());
  };

  // Generate combined session URL
  const getCombinedUrl = () => {
    const ids = Array.from(selectedSessions);
    return `${window.location.origin}/tracker/session/${ids.map((id) => encodeURIComponent(id)).join("+")}`;
  };

  // Copy URL to clipboard
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getCombinedUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Fetch player stats (all-time)
  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setStatsLoading(true);
        const analyticsResponse = await fetch(
          `${API_BASE}/analytics/players/${encodeURIComponent(playerName)}`
        );
        const analyticsData = await analyticsResponse.json();
        
        if (analyticsData && !analyticsData.error) {
          if (analyticsData.total_kills !== undefined) {
            setPlayerStats({
              player_name: playerName,
              total_kills: analyticsData.total_kills || 0,
              total_deaths: analyticsData.total_deaths || 0,
              kd_ratio: analyticsData.kd_ratio || 0,
              total_games: analyticsData.total_games || 0,
              total_time_played: analyticsData.total_time_played,
            });
          } else {
            try {
              const statsResponse = await fetch(
                `${API_BASE}/player-stats/${encodeURIComponent(playerName)}`
              );
              const statsData = await statsResponse.json();
              if (statsData && !statsData.error && statsData.total_kills !== undefined) {
                setPlayerStats({
                  player_name: playerName,
                  total_kills: statsData.total_kills || 0,
                  total_deaths: statsData.total_deaths || 0,
                  kd_ratio: statsData.kd_ratio || 0,
                  total_games: statsData.total_games || 0,
                  total_time_played: statsData.total_time_played,
                });
              }
            } catch (statsErr) {
              // Ignore if player-stats endpoint doesn't work
            }
          }
        }
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch player stats:', err);
        setError('Failed to fetch player stats');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchPlayerStats();
  }, [playerName]);

  // Fetch player map stats
  useEffect(() => {
    const fetchMapStats = async () => {
      try {
        setMapStatsLoading(true);
        const response = await fetch(
          `${API_BASE}/analytics/players/${encodeURIComponent(playerName)}/maps`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          setMapStats(data);
        } else {
          setMapStats([]);
        }
      } catch (err) {
        console.error('Failed to fetch map stats:', err);
        setMapStats([]);
      } finally {
        setMapStatsLoading(false);
      }
    };

    fetchMapStats();
  }, [playerName]);

  // Fetch player sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setSessionsLoading(true);
        const params = new URLSearchParams();
        if (startTime) {
          params.append('start_time', new Date(startTime).toISOString());
        }
        if (endTime) {
          params.append('end_time', new Date(endTime).toISOString());
        }
        params.append('limit', limit.toString());
        
        const response = await fetch(
          `${API_BASE}/players/${encodeURIComponent(playerName)}/sessions?${params.toString()}`
        );
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setSessions(data);
        } else if (data.sessions && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        } else {
          setSessions([]);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError('Failed to fetch sessions');
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };

    fetchSessions();
  }, [playerName, startTime, endTime, limit]);

  const formatDate = (dateString: string) => {
    try {
      let dateStr = dateString;
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <SidebarLayout>
      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-6">
            <Link
              href="/tracker"
              className="text-blue-400 hover:text-blue-300 hover:underline text-sm mb-2 inline-block"
            >
              ← Back to Tracker
            </Link>
            <h1 className="text-white text-2xl sm:text-3xl font-bold break-words">{playerName}</h1>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
              {error}
            </div>
          )}

          {/* Player Stats */}
          {statsLoading ? (
            <div className="text-white text-center py-8">Loading stats...</div>
          ) : playerStats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                <div className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Total Kills</div>
                <div className="text-xl sm:text-3xl font-bold text-green-400">{playerStats.total_kills}</div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                <div className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Total Deaths</div>
                <div className="text-xl sm:text-3xl font-bold text-red-400">{playerStats.total_deaths}</div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                <div className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">K/D Ratio</div>
                <div className="text-xl sm:text-3xl font-bold text-white">
                  {playerStats.kd_ratio.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                <div className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Total Games</div>
                <div className="text-xl sm:text-3xl font-bold text-white">{playerStats.total_games}</div>
              </div>
              {playerStats.total_time_played && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 col-span-2 lg:col-span-4">
                  <div className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2">Time Played</div>
                  <div className="text-xl sm:text-3xl font-bold text-white">{formatDuration(playerStats.total_time_played)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400 mb-6">
              No player stats found
            </div>
          )}

          {/* Per-Map Stats Section */}
          <div className="mb-6">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-4">Stats by Map</h2>
            {mapStatsLoading ? (
              <div className="text-white text-center py-8">Loading map stats...</div>
            ) : mapStats.length > 0 ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-white text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-700 bg-gray-800">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Map</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Kills</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Deaths</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">K/D</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapStats.map((stat) => (
                        <tr
                          key={stat.map_name}
                          className="border-b border-gray-800 hover:bg-gray-800"
                        >
                          <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">{stat.map_name}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-green-400">{stat.total_kills}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-red-400">{stat.total_deaths}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                            <span className={stat.kd_ratio >= 1 ? 'text-green-400' : 'text-red-400'}>
                              {stat.kd_ratio.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-gray-400">{stat.total_sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
                No map stats found
              </div>
            )}
          </div>

          {/* Sessions Section */}
          <div className="mb-4">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-4">Recent Sessions</h2>

            {/* Time filters */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">Limit</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 25)}
                    min="1"
                    max="100"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Sessions Table */}
            {sessionsLoading ? (
              <div className="text-white text-center py-8">Loading sessions...</div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-white text-xs sm:text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-700 bg-gray-800">
                          <th className="py-2 sm:py-3 px-2 sm:px-4 w-10">
                            <input
                              type="checkbox"
                              checked={sessions.length > 0 && selectedSessions.size === sessions.length}
                              onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                              className="w-4 h-4 accent-cyan-500 cursor-pointer"
                              title="Select all"
                            />
                          </th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Session ID</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Start Time</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">End Time</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Map</th>
                          <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Server IP</th>
                          <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Players</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.length > 0 ? (
                          sessions.map((session) => (
                            <tr
                              key={session.session_id}
                              className={`border-b border-gray-800 hover:bg-gray-800 cursor-pointer ${selectedSessions.has(session.session_id) ? "bg-cyan-900/30" : ""
                                }`}
                              onClick={() => toggleSessionSelection(session.session_id)}
                            >
                              <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedSessions.has(session.session_id)}
                                  onChange={() => toggleSessionSelection(session.session_id)}
                                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4" onClick={(e) => e.stopPropagation()}>
                                <SessionHoverPopover
                                  session={session}
                                  className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs truncate block max-w-[120px] sm:max-w-none"
                                />
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">{formatDate(session.time_started)}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">{session.time_finished ? formatDate(session.time_finished) : "Active"}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4">{session.map || "N/A"}</td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 font-mono text-xs">{session.server_ip || "N/A"}</td>
                              <td className="text-center py-2 sm:py-3 px-2 sm:px-4">{session.peak_players || "N/A"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                              <td colSpan={7} className="text-center py-8 text-gray-400">
                            No sessions found in the selected time range
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating selection bar */}
      {selectedSessions.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-cyan-500 rounded-lg shadow-lg shadow-cyan-500/20 px-4 py-3 flex items-center gap-3 sm:gap-4">
          <span className="text-white text-sm font-medium">
            {selectedSessions.size} session{selectedSessions.size > 1 ? "s" : ""} selected
          </span>

          {selectedSessions.size >= 2 && (
            <>
              <Link
                href={`/tracker/session/${Array.from(selectedSessions).map((id) => encodeURIComponent(id)).join("+")}`}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
              >
                View Combined
              </Link>
              <button
                onClick={copyUrl}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy URL
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Clear selection"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </SidebarLayout>
  );
};

export default PlayerDetailClient;
