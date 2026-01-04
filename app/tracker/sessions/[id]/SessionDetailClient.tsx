"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import TrackerLayout from "../../TrackerLayout";
import Link from "next/link";

const API_BASE = "https://server-details.ej.workers.dev";

// Delimiter for multiple session IDs in URL
// Use + as it's URL-safe and readable: /tracker/sessions/id1+id2+id3
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

const SessionDetailClient = () => {
  const params = useParams();
  const rawId = params.id as string;
  
  // Split on delimiter and limit to 8 sessions
  // Decode URI components to handle any encoded characters
  const sessionIds = rawId
    ? decodeURIComponent(rawId)
        .split(SESSION_DELIMITER)
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .slice(0, 8)
    : [];
  
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

  return (
    <TrackerLayout>
      <div className="mb-6">
        <Link
          href="/tracker/sessions"
          className="text-blue-400 hover:text-blue-300 hover:underline text-sm mb-2 inline-block"
        >
          ← Back to Sessions
        </Link>
        <h1 className="text-white text-xl sm:text-2xl md:text-3xl font-bold break-all">
          {isMultipleSessions 
            ? `Combined Sessions (${sessions.length})`
            : `Session ${sessionIds[0] || ''}`
          }
        </h1>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-white text-center py-12">Loading...</div>
      )}

      {!loading && sessions.length > 0 && aggregatedInfo && (
        <>
          {/* Session Info */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">
              Session Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Session Count (for multiple) */}
              {isMultipleSessions && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">Total Sessions</div>
                  <div className="text-white font-bold text-lg">{aggregatedInfo.sessionCount}</div>
                </div>
              )}
              
              {/* Session IDs */}
              <div className={isMultipleSessions ? "sm:col-span-2" : ""}>
                <div className="text-gray-400 text-xs sm:text-sm mb-1">
                  {isMultipleSessions ? 'Session IDs' : 'Session ID'}
                </div>
                <div className="text-white font-mono text-xs sm:text-sm break-all space-y-1">
                  {aggregatedInfo.sessionIds.map((id, idx) => (
                    <div key={id} className="flex items-center gap-2">
                      {isMultipleSessions && (
                        <span className="text-gray-500 text-xs">#{idx + 1}</span>
                      )}
                      <span>{id}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Start Time */}
              {aggregatedInfo.earliestStart && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">
                    {isMultipleSessions ? 'First Start Time' : 'Start Time'}
                  </div>
                  <div className="text-white text-sm">{formatDate(aggregatedInfo.earliestStart.toISOString())}</div>
                </div>
              )}
              
              {/* End Time */}
              {aggregatedInfo.latestEnd && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">
                    {isMultipleSessions ? 'Last End Time' : 'End Time'}
                  </div>
                  <div className="text-white text-sm">{formatDate(aggregatedInfo.latestEnd.toISOString())}</div>
                </div>
              )}
              
              {/* Duration */}
              {aggregatedInfo.totalDuration > 0 && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">
                    {isMultipleSessions ? 'Total Duration' : 'Duration'}
                  </div>
                  <div className="text-white text-sm">{formatDuration(aggregatedInfo.totalDuration)}</div>
                </div>
              )}
              
              {/* Maps */}
              {aggregatedInfo.uniqueMaps.length > 0 && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">
                    {aggregatedInfo.uniqueMaps.length > 1 ? 'Maps' : 'Map'}
                  </div>
                  <div className="text-white text-sm">
                    {aggregatedInfo.uniqueMaps.join(', ')}
                  </div>
                </div>
              )}
              
              {/* Server IPs */}
              {aggregatedInfo.uniqueIPs.length > 0 && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">
                    {aggregatedInfo.uniqueIPs.length > 1 ? 'Server IPs' : 'Server IP'}
                  </div>
                  <div className="text-white font-mono text-xs sm:text-sm">
                    {aggregatedInfo.uniqueIPs.map((ip, idx) => (
                      <div key={ip}>
                        {aggregatedInfo.uniqueIPs.length > 1 && (
                          <span className="text-gray-500 mr-2">#{idx + 1}</span>
                        )}
                        {ip}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Total Players (for multiple sessions) */}
              {isMultipleSessions && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">Total Players</div>
                  <div className="text-white text-sm">{aggregatedInfo.totalPlayers}</div>
                </div>
              )}
              
              {/* Peak Players (for single session) */}
              {!isMultipleSessions && sessions[0]?.peak_players !== undefined && (
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">Peak Players</div>
                  <div className="text-white text-sm">{sessions[0].peak_players}</div>
                </div>
              )}
            </div>
          </div>

          {/* Session Analytics */}
          {(aggregatedAnalytics.totalKills > 0 || aggregatedAnalytics.totalDeaths > 0) && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                {isMultipleSessions ? 'Combined Statistics' : 'Session Statistics'}
              </h2>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">Total Kills</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-400">{aggregatedAnalytics.totalKills}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs sm:text-sm mb-1">Total Deaths</div>
                  <div className="text-xl sm:text-2xl font-bold text-red-400">{aggregatedAnalytics.totalDeaths}</div>
                </div>
                {aggregatedInfo.totalDuration > 0 && (
                  <div>
                    <div className="text-gray-400 text-xs sm:text-sm mb-1">Duration</div>
                    <div className="text-xl sm:text-2xl font-bold text-white">{formatDuration(aggregatedInfo.totalDuration)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Players */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-700">
              <h2 className="text-white text-lg sm:text-xl font-bold">
                Players ({aggregatedPlayers.length})
                {isMultipleSessions && (
                  <span className="text-gray-400 text-sm font-normal ml-2">(combined stats)</span>
                )}
              </h2>
            </div>
            {aggregatedPlayers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-white text-xs sm:text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-800">
                      <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Rank</th>
                      <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Player</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Kills</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Deaths</th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4">K/D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedPlayers.map((player, index) => (
                      <tr
                        key={`${player.name}-${index}`}
                        className="border-b border-gray-800 hover:bg-gray-800"
                      >
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-400">#{index + 1}</td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <Link
                            href={`/tracker/player/${encodeURIComponent(player.name)}`}
                            className="text-blue-400 hover:text-blue-300 hover:underline font-medium truncate block max-w-[120px] sm:max-w-none"
                          >
                            {player.name}
                          </Link>
                        </td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-green-400">{player.kills}</td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-red-400">{player.deaths}</td>
                        <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                          {calculateKD(player.kills, player.deaths)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center text-gray-400">
                No players found for {isMultipleSessions ? 'these sessions' : 'this session'}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && sessions.length === 0 && !error && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          Session not found
        </div>
      )}
    </TrackerLayout>
  );
};

export default SessionDetailClient;

