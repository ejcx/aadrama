"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API_BASE = "https://server-details.ej.workers.dev";

// Delimiter for multiple session IDs in URL
const SESSION_DELIMITER = "+";

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  server_ip?: string;
  map?: string;
  peak_players?: number;
  duration?: number;
}

interface SessionPlayer {
  name: string;
  kills: number;
  deaths: number;
  player_honor?: number;
}

interface SessionAnalytics {
  total_kills?: number;
  total_deaths?: number;
  player_count?: number;
  duration?: number;
}

interface AggregatedPlayer {
  name: string;
  kills: number;
  deaths: number;
}

interface SessionContentProps {
  sessionIds: string[];
  compact?: boolean; // For popover use - hide some UI elements
}

export const SessionContent = ({ sessionIds, compact = false }: SessionContentProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allPlayers, setAllPlayers] = useState<Map<string, SessionPlayer[]>>(new Map());
  const [allAnalytics, setAllAnalytics] = useState<Map<string, SessionAnalytics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sessionPromises = sessionIds.map(async (id) => {
          try {
            const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}`);
            const data = await response.json();
            if (data && !data.error) {
              return data as Session;
            }
            return null;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(sessionPromises);
        const validSessions = results.filter((s): s is Session => s !== null);
        
        if (validSessions.length === 0) {
          setError('No valid sessions found');
        }
        
        setSessions(validSessions);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError('Failed to fetch sessions');
      } finally {
        setLoading(false);
      }
    };

    if (sessionIds.length > 0) {
      fetchSessions();
    } else {
      setError('No session IDs provided');
      setLoading(false);
    }
  }, [sessionIds.join(',')]);

  // Fetch all session players
  useEffect(() => {
    const fetchAllPlayers = async () => {
      const playersMap = new Map<string, SessionPlayer[]>();
      
      await Promise.all(sessionIds.map(async (id) => {
        try {
          const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}/players`);
          const data = await response.json();
          
          let players: SessionPlayer[] = [];
          if (Array.isArray(data)) {
            players = data;
          } else if (data.players && Array.isArray(data.players)) {
            players = data.players;
          }
          
          playersMap.set(id, players);
        } catch (err) {
          console.error(`Failed to fetch players for session ${id}:`, err);
          playersMap.set(id, []);
        }
      }));
      
      setAllPlayers(playersMap);
    };

    if (sessionIds.length > 0) {
      fetchAllPlayers();
    }
  }, [sessionIds.join(',')]);

  // Fetch all session analytics
  useEffect(() => {
    const fetchAllAnalytics = async () => {
      const analyticsMap = new Map<string, SessionAnalytics>();
      
      await Promise.all(sessionIds.map(async (id) => {
        try {
          const response = await fetch(`${API_BASE}/analytics/sessions/${encodeURIComponent(id)}`);
          const data = await response.json();
          
          if (data && !data.error) {
            analyticsMap.set(id, data);
          }
        } catch (err) {
          console.error(`Failed to fetch analytics for session ${id}:`, err);
        }
      }));
      
      setAllAnalytics(analyticsMap);
    };

    if (sessionIds.length > 0) {
      fetchAllAnalytics();
    }
  }, [sessionIds.join(',')]);

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

  const parseDate = (dateString: string): Date | null => {
    try {
      let dateStr = dateString;
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        dateStr = dateStr.replace(' ', 'T');
        if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
          dateStr += 'Z';
        }
      }
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const calculateKD = (kills: number, deaths: number) => {
    if (deaths === 0) return kills > 0 ? '∞' : '0.00';
    return (kills / deaths).toFixed(2);
  };

  // Aggregate player stats across all sessions
  const getAggregatedPlayers = (): AggregatedPlayer[] => {
    const playerMap = new Map<string, AggregatedPlayer>();
    
    allPlayers.forEach((players) => {
      players.forEach((player) => {
        const existing = playerMap.get(player.name);
        if (existing) {
          existing.kills += player.kills;
          existing.deaths += player.deaths;
        } else {
          playerMap.set(player.name, {
            name: player.name,
            kills: player.kills,
            deaths: player.deaths,
          });
        }
      });
    });
    
    return Array.from(playerMap.values()).sort((a, b) => b.kills - a.kills);
  };

  // Get aggregated session info
  const getAggregatedSessionInfo = () => {
    if (sessions.length === 0) return null;
    
    // Get earliest start time
    const startTimes = sessions
      .map(s => parseDate(s.time_started))
      .filter((d): d is Date => d !== null);
    const earliestStart = startTimes.length > 0 
      ? new Date(Math.min(...startTimes.map(d => d.getTime())))
      : null;
    
    // Get latest end time
    const endTimes = sessions
      .map(s => s.time_finished ? parseDate(s.time_finished) : null)
      .filter((d): d is Date => d !== null);
    const latestEnd = endTimes.length > 0
      ? new Date(Math.max(...endTimes.map(d => d.getTime())))
      : null;
    
    // Calculate total duration
    let totalDuration = 0;
    if (earliestStart && latestEnd) {
      totalDuration = Math.floor((latestEnd.getTime() - earliestStart.getTime()) / 1000);
    }
    
    // Get unique IPs
      const uniqueIPs = Array.from(new Set(sessions.map(s => s.server_ip).filter((ip): ip is string => Boolean(ip))));
    
    // Get unique maps
      const uniqueMaps = Array.from(new Set(sessions.map(s => s.map).filter((m): m is string => Boolean(m))));
    
    // Get total unique players across all sessions
    const allPlayerNames = new Set<string>();
    allPlayers.forEach((players) => {
      players.forEach((player) => allPlayerNames.add(player.name));
    });
    
    return {
      sessionCount: sessions.length,
      sessionIds: sessions.map(s => s.session_id),
      earliestStart,
      latestEnd,
      totalDuration,
      uniqueIPs,
      uniqueMaps,
      totalPlayers: allPlayerNames.size,
    };
  };

  // Get aggregated analytics
  const getAggregatedAnalytics = () => {
    let totalKills = 0;
    let totalDeaths = 0;
    
    allAnalytics.forEach((analytics) => {
      totalKills += analytics.total_kills || 0;
      totalDeaths += analytics.total_deaths || 0;
    });
    
    return { totalKills, totalDeaths };
  };

  const isMultipleSessions = sessions.length > 1;
  const aggregatedPlayers = getAggregatedPlayers();
  const aggregatedInfo = getAggregatedSessionInfo();
  const aggregatedAnalytics = getAggregatedAnalytics();

  // Build the URL path for linking to the full session page
  const getSessionUrl = () => {
    return `/tracker/session/${sessionIds.map(id => encodeURIComponent(id)).join(SESSION_DELIMITER)}`;
  };

  if (loading) {
    return (
      <div className="text-white text-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading session data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200 text-sm">
        {error}
      </div>
    );
  }

  if (sessions.length === 0 || !aggregatedInfo) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center text-gray-400">
        Session not found
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4 sm:space-y-6"}>
      {/* Session Info */}
      <div className={`bg-gray-900 border border-gray-700 rounded-lg ${compact ? "p-3" : "p-4 sm:p-6"}`}>
        <h2 className={`text-white font-bold ${compact ? "text-base mb-2" : "text-lg sm:text-xl mb-3 sm:mb-4"}`}>
          Session Information
        </h2>
        <div className={`grid ${compact ? "grid-cols-2 gap-2 text-xs" : "grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"}`}>
          {/* Session Count (for multiple) */}
          {isMultipleSessions && (
            <div>
              <div className="text-gray-400 text-xs mb-0.5">Total Sessions ({aggregatedInfo.sessionCount})</div>
              <div className="flex flex-wrap gap-1.5">
                {aggregatedInfo.sessionIds.map((sessionId, index) => (
                  <Link
                    key={sessionId}
                    href={`/tracker/session/${encodeURIComponent(sessionId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded transition-colors ${compact ? "text-xs px-1.5 py-0.5 min-w-[24px]" : "text-sm px-2 py-1 min-w-[28px]"}`}
                  >
                    {index + 1}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {/* Maps */}
          {aggregatedInfo.uniqueMaps.length > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-0.5">
                {aggregatedInfo.uniqueMaps.length > 1 ? 'Maps' : 'Map'}
              </div>
              <div className={`text-white ${compact ? "text-sm" : "text-sm"}`}>
                {aggregatedInfo.uniqueMaps.join(', ')}
              </div>
            </div>
          )}
          
          {/* Duration */}
          {aggregatedInfo.totalDuration > 0 && (
            <div>
              <div className="text-gray-400 text-xs mb-0.5">
                {isMultipleSessions ? 'Total Duration' : 'Duration'}
              </div>
              <div className={`text-white ${compact ? "text-sm" : "text-sm"}`}>{formatDuration(aggregatedInfo.totalDuration)}</div>
            </div>
          )}
          
          {/* Total Players */}
          <div>
            <div className="text-gray-400 text-xs mb-0.5">
              {isMultipleSessions ? 'Total Players' : 'Players'}
            </div>
            <div className={`text-white ${compact ? "text-sm" : "text-sm"}`}>{aggregatedInfo.totalPlayers}</div>
          </div>
        </div>
      </div>

      {/* Session Analytics */}
      {(aggregatedAnalytics.totalKills > 0 || aggregatedAnalytics.totalDeaths > 0) && (
        <div className={`bg-gray-900 border border-gray-700 rounded-lg ${compact ? "p-3" : "p-4 sm:p-6"}`}>
          <h2 className={`text-white font-bold ${compact ? "text-base mb-2" : "text-lg sm:text-xl mb-3 sm:mb-4"}`}>
            {isMultipleSessions ? 'Combined Statistics' : 'Session Statistics'}
          </h2>
          <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3 sm:gap-4"}`}>
            <div>
              <div className="text-gray-400 text-xs mb-0.5">Total Kills</div>
              <div className={`font-bold text-green-400 ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{aggregatedAnalytics.totalKills}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-0.5">Total Deaths</div>
              <div className={`font-bold text-red-400 ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{aggregatedAnalytics.totalDeaths}</div>
            </div>
            {aggregatedInfo.totalDuration > 0 && (
              <div>
                <div className="text-gray-400 text-xs mb-0.5">Duration</div>
                <div className={`font-bold text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{formatDuration(aggregatedInfo.totalDuration)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Players */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className={`border-b border-gray-700 ${compact ? "p-2" : "p-3 sm:p-4"}`}>
          <h2 className={`text-white font-bold ${compact ? "text-base" : "text-lg sm:text-xl"}`}>
            Players ({aggregatedPlayers.length})
            {isMultipleSessions && (
              <span className="text-gray-400 text-xs font-normal ml-2">(combined)</span>
            )}
          </h2>
        </div>
        {aggregatedPlayers.length > 0 ? (
          <div className={`overflow-x-auto ${compact ? "max-h-48" : ""}`}>
            <table className={`w-full text-white ${compact ? "text-xs" : "text-xs sm:text-sm"} min-w-[300px]`}>
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800">
                  <th className={`text-left ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>#</th>
                  <th className={`text-left ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>Player</th>
                  <th className={`text-center ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>K</th>
                  <th className={`text-center ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>D</th>
                  <th className={`text-center ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>K/D</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedPlayers.slice(0, compact ? 10 : undefined).map((player, index) => (
                  <tr
                    key={`${player.name}-${index}`}
                    className="border-b border-gray-800 hover:bg-gray-800"
                  >
                    <td className={`text-gray-400 ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>#{index + 1}</td>
                    <td className={compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}>
                      <Link
                        href={`/tracker/player/${encodeURIComponent(player.name)}`}
                        className="text-blue-400 hover:text-blue-300 hover:underline font-medium truncate block max-w-[100px]"
                        target={compact ? "_blank" : undefined}
                      >
                        {player.name}
                      </Link>
                    </td>
                    <td className={`text-center text-green-400 ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>{player.kills}</td>
                    <td className={`text-center text-red-400 ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>{player.deaths}</td>
                    <td className={`text-center ${compact ? "py-1 px-2" : "py-2 sm:py-3 px-2 sm:px-4"}`}>
                      {calculateKD(player.kills, player.deaths)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compact && aggregatedPlayers.length > 10 && (
              <div className="text-center text-gray-400 text-xs py-2 border-t border-gray-700">
                +{aggregatedPlayers.length - 10} more players
              </div>
            )}
          </div>
        ) : (
          <div className={`text-center text-gray-400 ${compact ? "p-4" : "p-6 sm:p-8"}`}>
            No players found
          </div>
        )}
      </div>

      {/* Go to Session Tracker link */}
      {compact && (
        <Link
          href={getSessionUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Go to Session Tracker
        </Link>
      )}
    </div>
  );
};

export default SessionContent;

