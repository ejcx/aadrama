"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SidebarLayout from "../../../components/SidebarLayout";
import Link from "next/link";

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
}

interface SessionPlayer {
  player_name: string;
  kills: number;
  deaths: number;
  kd_ratio?: number;
}

interface AnalyticsData {
  kills_over_time?: Array<{ date: string; kills: number }>;
  stats_over_time?: Array<{ date: string; kills: number; deaths: number; kd_ratio: number }>;
}

const PlayerDetailClient = () => {
  const params = useParams();
  const playerName = decodeURIComponent(params.name as string);
  
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "analytics">("overview");
  
  // Time filter for sessions
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  // Fetch player stats (all-time)
  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setLoading(true);
        // First, try to get analytics which might have player stats
        const analyticsResponse = await fetch(
          `${API_BASE}/analytics/players/${encodeURIComponent(playerName)}`
        );
        const analyticsData = await analyticsResponse.json();
        
        if (analyticsData && !analyticsData.error) {
          setAnalytics(analyticsData);
          // Extract stats from analytics if available
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
            // If no stats in analytics, try player-stats endpoint
            try {
              // Note: player-stats might need an ID, but let's try with name first
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
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [playerName]);

  // Fetch player sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    };

    if (activeTab === "sessions") {
      fetchSessions();
    }
  }, [playerName, activeTab, startTime, endTime, limit]);

  // Fetch filtered analytics
  useEffect(() => {
    const fetchFilteredAnalytics = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (startTime) {
          params.append('start_time', new Date(startTime).toISOString());
        }
        if (endTime) {
          params.append('end_time', new Date(endTime).toISOString());
        }
        
        const response = await fetch(
          `${API_BASE}/analytics/players/${encodeURIComponent(playerName)}/filtered?${params.toString()}`
        );
        const data = await response.json();
        
        if (data && !data.error) {
          setAnalytics(data);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === "analytics") {
      fetchFilteredAnalytics();
    }
  }, [playerName, activeTab, startTime, endTime]);

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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col px-8 py-12">
        <div className="max-w-6xl w-full mx-auto">
          <div className="mb-6">
            <Link
              href="/tracker"
              className="text-blue-400 hover:text-blue-300 hover:underline text-sm mb-2 inline-block"
            >
              ← Back to Tracker
            </Link>
            <h1 className="text-white text-3xl font-bold">{playerName}</h1>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                activeTab === "overview"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                activeTab === "sessions"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-4 py-2 font-semibold text-sm transition-colors ${
                activeTab === "analytics"
                  ? "text-white border-b-2 border-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Time filters for sessions and analytics */}
          {(activeTab === "sessions" || activeTab === "analytics") && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Start Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">End Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                {activeTab === "sessions" && (
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
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-white text-center py-12">Loading...</div>
          )}

          {/* Overview Tab */}
          {!loading && activeTab === "overview" && playerStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Total Kills</div>
                <div className="text-white text-3xl font-bold text-green-400">{playerStats.total_kills}</div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Total Deaths</div>
                <div className="text-white text-3xl font-bold text-red-400">{playerStats.total_deaths}</div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">K/D Ratio</div>
                <div className="text-white text-3xl font-bold">
                  {playerStats.kd_ratio.toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Total Games</div>
                <div className="text-white text-3xl font-bold">{playerStats.total_games}</div>
              </div>
              {playerStats.total_time_played && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                  <div className="text-gray-400 text-sm mb-2">Time Played</div>
                  <div className="text-white text-3xl font-bold">{formatDuration(playerStats.total_time_played)}</div>
                </div>
              )}
            </div>
          )}

          {/* Sessions Tab */}
          {!loading && activeTab === "sessions" && (
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
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length > 0 ? (
                      sessions.map((session) => (
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

          {/* Analytics Tab */}
          {!loading && activeTab === "analytics" && (
            <div className="space-y-6">
              {analytics && (
                <>
                  {analytics.kills_over_time && analytics.kills_over_time.length > 0 && (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                      <h2 className="text-white text-xl font-bold mb-4">Kills Over Time</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-white text-sm">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-2 px-2">Date</th>
                              <th className="text-center py-2 px-2">Kills</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.kills_over_time.map((entry, index) => (
                              <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                                <td className="py-2 px-2">{formatDate(entry.date)}</td>
                                <td className="text-center py-2 px-2 text-green-400">{entry.kills}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {analytics.stats_over_time && analytics.stats_over_time.length > 0 && (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                      <h2 className="text-white text-xl font-bold mb-4">Stats Over Time</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-white text-sm">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-2 px-2">Date</th>
                              <th className="text-center py-2 px-2">Kills</th>
                              <th className="text-center py-2 px-2">Deaths</th>
                              <th className="text-center py-2 px-2">K/D</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.stats_over_time.map((entry, index) => (
                              <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                                <td className="py-2 px-2">{formatDate(entry.date)}</td>
                                <td className="text-center py-2 px-2 text-green-400">{entry.kills}</td>
                                <td className="text-center py-2 px-2 text-red-400">{entry.deaths}</td>
                                <td className="text-center py-2 px-2">{entry.kd_ratio.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(!analytics.kills_over_time || analytics.kills_over_time.length === 0) &&
                   (!analytics.stats_over_time || analytics.stats_over_time.length === 0) && (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
                      No analytics data available
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && activeTab === "overview" && !playerStats && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
              No player data found
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
};

export default PlayerDetailClient;
