"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import SidebarLayout from "../../../components/SidebarLayout";
import Link from "next/link";
import { SessionHoverPopover } from "../../../components/SessionHoverPopover";
import { getPlayerElo, getPlayerEloHistory, getPlayerRank, getPlayerDailyKills } from "../../actions";
import { getPlayerScrims, getScrimMaps, type PlayerScrimResult } from "../../../scrim/actions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = "https://server-details.ej.workers.dev";

interface ChartDataPoint {
  date: string;
  kills: number;
  deaths: number;
}

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

interface PlayerEloData {
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  eloChange7Days: number;
  rank: number | null; // Position in leaderboard (1 = highest)
  recentHistory: Array<{
    scrim_id: string;
    elo_change: number;
    elo_after: number;
    result: string;
    created_at: string;
  }>;
}

// Grandmaster Badge Component for top 10 players
function GrandmasterBadge({ rank }: { rank: number }) {
  // Different tiers within top 10
  const isTop3 = rank <= 3;
  const isTop1 = rank === 1;
  
  return (
    <div className="relative group cursor-pointer" title={`Rank #${rank} - Top 10 Competitive Player`}>
      <div className={`
        relative flex items-center justify-center
        w-14 h-14 sm:w-16 sm:h-16
        ${isTop1 
          ? 'animate-pulse' 
          : ''
        }
      `}>
        {/* Outer glow */}
        <div className={`
          absolute inset-0 rounded-full blur-md opacity-60
          ${isTop1 
            ? 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600' 
            : isTop3 
              ? 'bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700'
              : 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700'
          }
        `} />
        
        {/* Main badge shape - hexagonal/diamond inspired */}
        <svg 
          viewBox="0 0 100 100" 
          className={`
            relative w-12 h-12 sm:w-14 sm:h-14 drop-shadow-lg
            ${isTop1 ? 'animate-spin-slow' : ''}
          `}
          style={{ animationDuration: '20s' }}
        >
          <defs>
            {/* Gradient definitions */}
            <linearGradient id={`gmGrad${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
              {isTop1 ? (
                <>
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </>
              ) : isTop3 ? (
                <>
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#6366f1" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </>
              )}
            </linearGradient>
            <linearGradient id={`gmInner${rank}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
          </defs>
          
          {/* Outer hexagon */}
          <polygon 
            points="50,2 93,25 93,75 50,98 7,75 7,25" 
            fill={`url(#gmGrad${rank})`}
            stroke={isTop1 ? "#fcd34d" : isTop3 ? "#c4b5fd" : "#67e8f9"}
            strokeWidth="2"
          />
          
          {/* Inner hexagon */}
          <polygon 
            points="50,12 83,30 83,70 50,88 17,70 17,30" 
            fill={`url(#gmInner${rank})`}
          />
          
          {/* Star/emblem in center */}
          <polygon 
            points="50,22 55,38 72,38 58,48 63,65 50,54 37,65 42,48 28,38 45,38" 
            fill={`url(#gmGrad${rank})`}
            opacity="0.9"
          />
          
          {/* Crown for #1 */}
          {isTop1 && (
            <path 
              d="M35,35 L40,28 L50,33 L60,28 L65,35 L60,35 L55,32 L50,35 L45,32 L40,35 Z"
              fill="#fcd34d"
            />
          )}
        </svg>
        
        {/* Rank number */}
        <div className={`
          absolute bottom-0 right-0
          w-5 h-5 sm:w-6 sm:h-6 
          rounded-full 
          flex items-center justify-center
          text-xs font-bold
          border-2
          ${isTop1 
            ? 'bg-yellow-500 text-yellow-950 border-yellow-300' 
            : isTop3 
              ? 'bg-purple-500 text-purple-950 border-purple-300'
              : 'bg-cyan-500 text-cyan-950 border-cyan-300'
          }
        `}>
          {rank}
        </div>
      </div>
      
      {/* Tooltip on hover */}
      <div className="
        absolute left-1/2 -translate-x-1/2 -bottom-8
        opacity-0 group-hover:opacity-100 transition-opacity
        whitespace-nowrap text-xs font-medium
        px-2 py-1 rounded bg-gray-800 text-gray-200
        pointer-events-none z-10
      ">
        {isTop1 ? '👑 #1 Champion' : isTop3 ? '🏆 Elite' : '⭐ Grandmaster'}
      </div>
    </div>
  );
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
  const [eloData, setEloData] = useState<PlayerEloData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [mapStatsLoading, setMapStatsLoading] = useState(true);
  const [eloLoading, setEloLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Session selection state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Time filter for sessions with defaults
  const defaultDates = getDefaultDates();
  const [startTime, setStartTime] = useState<string>(defaultDates.start);
  const [endTime, setEndTime] = useState<string>(defaultDates.end);
  const [limit, setLimit] = useState<number>(25);
  const [sessionMapFilter, setSessionMapFilter] = useState<string>("");

  // Scrim results state
  const [scrimResults, setScrimResults] = useState<PlayerScrimResult[]>([]);
  const [scrimsLoading, setScrimsLoading] = useState(true);
  const [scrimMaps, setScrimMaps] = useState<string[]>([]);
  const [scrimStartTime, setScrimStartTime] = useState<string>(defaultDates.start);
  const [scrimEndTime, setScrimEndTime] = useState<string>(defaultDates.end);
  const [scrimMapFilter, setScrimMapFilter] = useState<string>("");
  const [scrimLimit, setScrimLimit] = useState<number>(25);

  // Daily kills chart state
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [dailyStatsLoading, setDailyStatsLoading] = useState(true);
  const [chartMapFilter, setChartMapFilter] = useState<string>("");
  const [availableChartMaps, setAvailableChartMaps] = useState<string[]>([]);
  
  // Chart time range state
  type ChartTimeRange = "30d" | "60d" | "90d" | "all";
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>("30d");

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

  // Fetch scrim maps
  useEffect(() => {
    const fetchScrimMaps = async () => {
      try {
        const maps = await getScrimMaps();
        setScrimMaps(maps);
      } catch (err) {
        console.error('Failed to fetch scrim maps:', err);
      }
    };
    fetchScrimMaps();
  }, []);

  // Fetch player scrims
  useEffect(() => {
    const fetchPlayerScrims = async () => {
      // Need to get the player's game name from ELO data or use playerName
      try {
        setScrimsLoading(true);
        const scrims = await getPlayerScrims({
          gameName: playerName,
          limit: scrimLimit,
          startTime: scrimStartTime ? new Date(scrimStartTime).toISOString() : undefined,
          endTime: scrimEndTime ? new Date(scrimEndTime).toISOString() : undefined,
          map: scrimMapFilter || undefined,
        });
        setScrimResults(scrims);
      } catch (err) {
        console.error('Failed to fetch player scrims:', err);
        setScrimResults([]);
      } finally {
        setScrimsLoading(false);
      }
    };
    fetchPlayerScrims();
  }, [playerName, scrimStartTime, scrimEndTime, scrimMapFilter, scrimLimit]);

  // Fetch player ELO data
  useEffect(() => {
    const fetchEloData = async () => {
      try {
        setEloLoading(true);

        // Fetch current ELO using server action
        const eloRecord = await getPlayerElo(playerName);

        if (!eloRecord) {
          setEloData(null);
          return;
        }

        // Fetch ELO history and rank in parallel using server actions
        const [historyRecords, rankData] = await Promise.all([
          getPlayerEloHistory(playerName, 7),
          getPlayerRank(playerName),
        ]);

        const rank = rankData?.rank || null;

        // Calculate 7-day ELO change
        const eloChange7Days = (historyRecords || []).reduce(
          (sum, record) => sum + record.elo_change,
          0
        );

        setEloData({
          elo: eloRecord.elo,
          games_played: eloRecord.games_played,
          wins: eloRecord.wins,
          losses: eloRecord.losses,
          draws: eloRecord.draws,
          eloChange7Days,
          rank,
          recentHistory: historyRecords || [],
        });
      } catch (err) {
        console.error('Failed to fetch ELO data:', err);
        setEloData(null);
      } finally {
        setEloLoading(false);
      }
    };

    fetchEloData();
  }, [playerName]);

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

  // Fetch daily stats for chart - using server action
  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        setDailyStatsLoading(true);
        
        // Calculate days for time range
        let days: number | null = null;
        if (chartTimeRange === "30d") days = 30;
        else if (chartTimeRange === "60d") days = 60;
        else if (chartTimeRange === "90d") days = 90;
        // "all" = null (no limit)
        
        const result = await getPlayerDailyKills(playerName, {
          days,
          map: chartMapFilter || null,
        });
        
        setChartData(result.data);
        // Only update available maps if no filter (so we keep the full list)
        if (!chartMapFilter) {
          setAvailableChartMaps(result.availableMaps);
        }
      } catch (err) {
        console.error('Failed to fetch daily stats:', err);
        setChartData([]);
      } finally {
        setDailyStatsLoading(false);
      }
    };

    fetchDailyStats();
  }, [playerName, chartTimeRange, chartMapFilter]);

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
        
        let sessionsData: Session[] = [];
        if (Array.isArray(data)) {
          sessionsData = data;
        } else if (data.sessions && Array.isArray(data.sessions)) {
          sessionsData = data.sessions;
        }
        
        // Apply client-side map filter if set
        if (sessionMapFilter) {
          sessionsData = sessionsData.filter(s => s.map === sessionMapFilter);
        }
        
        setSessions(sessionsData);
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
  }, [playerName, startTime, endTime, limit, sessionMapFilter]);

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

          {/* ELO Rating Section */}
          {!eloLoading && eloData && (
            <div className={`
              rounded-lg p-4 sm:p-6 mb-6 border
              ${eloData.rank !== null && eloData.rank <= 10
                ? eloData.rank === 1
                  ? 'bg-gradient-to-r from-yellow-900/40 via-amber-900/30 to-orange-900/40 border-yellow-600/70'
                  : eloData.rank <= 3
                    ? 'bg-gradient-to-r from-purple-900/40 via-violet-900/30 to-indigo-900/40 border-purple-600/70'
                    : 'bg-gradient-to-r from-cyan-900/40 via-blue-900/30 to-indigo-900/40 border-cyan-600/70'
                : 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-700/50'
              }
            `}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Grandmaster Badge for top 10 */}
                  {eloData.rank !== null && eloData.rank <= 10 && (
                    <GrandmasterBadge rank={eloData.rank} />
                  )}
                  
                  <div>
                    <div className="text-yellow-400/80 text-xs sm:text-sm mb-1">
                      Ranked ELO
                      {eloData.rank !== null && (
                        <span className="text-gray-400 ml-2">
                          #{eloData.rank}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl sm:text-4xl font-bold text-yellow-400">{eloData.elo}</span>
                      {eloData.eloChange7Days !== 0 && (
                        <span className={`text-lg sm:text-xl font-semibold ${eloData.eloChange7Days > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {eloData.eloChange7Days > 0 ? '▲' : '▼'} {eloData.eloChange7Days > 0 ? '+' : ''}{eloData.eloChange7Days}
                          <span className="text-xs sm:text-sm text-gray-400 ml-1">7d</span>
                        </span>
                      )}
                      {eloData.eloChange7Days === 0 && eloData.recentHistory.length > 0 && (
                        <span className="text-lg text-gray-400">
                          ─ <span className="text-xs sm:text-sm">7d</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 sm:gap-6 text-center">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Ranked Games</div>
                    <div className="text-white text-lg sm:text-xl font-semibold">{eloData.games_played}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-1">W-L-D</div>
                    <div className="text-sm sm:text-base">
                      <span className="text-green-400 font-semibold">{eloData.wins}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-red-400 font-semibold">{eloData.losses}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-gray-400 font-semibold">{eloData.draws}</span>
                    </div>
                  </div>
                  {eloData.games_played > 0 && (
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Win Rate</div>
                      <div className={`text-lg sm:text-xl font-semibold ${(eloData.wins / eloData.games_played) >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
                        {((eloData.wins / eloData.games_played) * 100).toFixed(0)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent ELO History */}
              {eloData.recentHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-yellow-700/30">
                  <div className="text-gray-400 text-xs mb-2">Recent Matches (7 days) - click to view scrim</div>
                  <div className="flex flex-wrap gap-2">
                    {eloData.recentHistory.slice(0, 10).map((match, i) => (
                      <Link
                        key={i}
                        href={`/scrim/${match.scrim_id}`}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all hover:scale-105 hover:shadow-lg ${match.result === 'win'
                          ? 'bg-green-900/50 text-green-400 border border-green-700/50 hover:bg-green-800/60 hover:border-green-600'
                          : match.result === 'loss'
                            ? 'bg-red-900/50 text-red-400 border border-red-700/50 hover:bg-red-800/60 hover:border-red-600'
                            : 'bg-gray-700/50 text-gray-400 border border-gray-600/50 hover:bg-gray-600/60 hover:border-gray-500'
                          }`}
                        title={`View scrim - ${new Date(match.created_at).toLocaleString()}`}
                      >
                        {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'D'}
                        {' '}
                        <span className={match.elo_change >= 0 ? 'text-green-300' : 'text-red-300'}>
                          {match.elo_change >= 0 ? '+' : ''}{match.elo_change}
                        </span>
                      </Link>
                    ))}
                    {eloData.recentHistory.length > 10 && (
                      <span className="text-gray-500 text-xs self-center">
                        +{eloData.recentHistory.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
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

          {/* Daily Stats Chart Section */}
          <div className="mb-6">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-4">Stats Over Time</h2>
            
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {/* Time range selector */}
                <div className="flex items-center gap-2">
                  <label className="text-gray-300 text-sm">Time Range:</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-600">
                    {(["30d", "60d", "90d", "all"] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setChartTimeRange(range)}
                        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                          chartTimeRange === range
                            ? "bg-cyan-600 text-white"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        {range === "all" ? "All Time" : range.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Map filter */}
                <div className="flex items-center gap-2">
                  <label className="text-gray-300 text-sm">Map:</label>
                  <select
                    value={chartMapFilter}
                    onChange={(e) => setChartMapFilter(e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm min-w-[140px]"
                  >
                    <option value="">All Maps</option>
                    {availableChartMaps.map((map) => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                  {chartMapFilter && (
                    <button
                      onClick={() => setChartMapFilter("")}
                      className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                      title="Clear filter"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              {dailyStatsLoading ? (
                <div className="h-[300px] sm:h-[400px] flex items-center justify-center text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading chart data...</span>
                  </div>
                </div>
              ) : chartData.length > 0 ? (
                <>
                {/* Chart */}
                <div className="h-[300px] sm:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        stroke="#4b5563"
                      />
                      <YAxis 
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        stroke="#4b5563"
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          });
                        }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length && label) {
                            const kills = payload.find(p => p.dataKey === 'kills')?.value as number || 0;
                            const deaths = payload.find(p => p.dataKey === 'deaths')?.value as number || 0;
                            const fragRate = deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? '∞' : '0.00';
                            const date = new Date(label as string);
                            const dateStr = date.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            });
                            return (
                              <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
                                <p className="text-gray-300 text-sm mb-2 font-medium">{dateStr}</p>
                                <div className="space-y-1">
                                  <p className="text-green-400 text-sm">
                                    <span className="text-gray-400">Kills:</span> {kills}
                                  </p>
                                  <p className="text-red-400 text-sm">
                                    <span className="text-gray-400">Deaths:</span> {deaths}
                                  </p>
                                  <p className={`text-sm font-semibold ${Number(fragRate) >= 1 || fragRate === '∞' ? 'text-green-400' : 'text-red-400'}`}>
                                    <span className="text-gray-400">Frag Rate:</span> {fragRate}
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="kills"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                        name="Kills"
                      />
                      <Bar
                        dataKey="deaths"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        name="Deaths"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Total Kills: </span>
                    <span className="text-green-400 font-semibold">
                      {chartData.reduce((sum, d) => sum + d.kills, 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Deaths: </span>
                    <span className="text-red-400 font-semibold">
                      {chartData.reduce((sum, d) => sum + d.deaths, 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Frag Rate: </span>
                    {(() => {
                      const totalKills = chartData.reduce((sum, d) => sum + d.kills, 0);
                      const totalDeaths = chartData.reduce((sum, d) => sum + d.deaths, 0);
                      const fragRate = totalDeaths > 0 ? totalKills / totalDeaths : totalKills > 0 ? Infinity : 0;
                      return (
                        <span className={`font-semibold ${fragRate >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                          {fragRate === Infinity ? '∞' : fragRate.toFixed(2)}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <span className="text-gray-400">Days played: </span>
                    <span className="text-white font-semibold">{chartData.filter(d => d.kills > 0 || d.deaths > 0).length}</span>
                  </div>
                </div>
                </>
              ) : (
                <div className="h-[300px] sm:h-[400px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-lg mb-2">No data for this time range</div>
                    <div className="text-sm">Try selecting a different time period or play some games!</div>
                  </div>
                </div>
              )}
            </div>
          </div>

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

          {/* Scrim Results Section */}
          <div className="mb-6">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-4">Scrim Results</h2>

            {/* Scrim filters */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={scrimStartTime}
                    onChange={(e) => setScrimStartTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={scrimEndTime}
                    onChange={(e) => setScrimEndTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">Map</label>
                  <select
                    value={scrimMapFilter}
                    onChange={(e) => setScrimMapFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  >
                    <option value="">All Maps</option>
                    {scrimMaps.map((map) => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">Limit</label>
                  <input
                    type="number"
                    value={scrimLimit}
                    onChange={(e) => setScrimLimit(parseInt(e.target.value) || 25)}
                    min="1"
                    max="100"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Scrim Results Table */}
            {scrimsLoading ? (
              <div className="text-white text-center py-8">Loading scrim results...</div>
            ) : scrimResults.length > 0 ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-white text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-gray-700 bg-gray-800">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Date</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Map</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Result</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Score</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">ELO</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scrimResults.map((scrim) => (
                        <tr
                          key={scrim.id}
                          className="border-b border-gray-800 hover:bg-gray-800"
                        >
                          <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-gray-400">
                            {new Date(scrim.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <span className="text-cyan-400">{scrim.map || 'Unknown'}</span>
                          </td>
                          <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              scrim.result === 'win' 
                                ? 'bg-green-900/50 text-green-400' 
                                : scrim.result === 'loss' 
                                  ? 'bg-red-900/50 text-red-400' 
                                  : 'bg-gray-700/50 text-gray-400'
                            }`}>
                              {scrim.result === 'win' ? 'WIN' : scrim.result === 'loss' ? 'LOSS' : 'DRAW'}
                            </span>
                          </td>
                          <td className="text-center py-2 sm:py-3 px-2 sm:px-4 font-mono">
                            {scrim.team_a_score !== null && scrim.team_b_score !== null ? (
                              <span>
                                <span className={scrim.player_team === 'team_a' ? 'text-white font-bold' : 'text-gray-400'}>
                                  {scrim.team_a_score}
                                </span>
                                <span className="text-gray-500"> - </span>
                                <span className={scrim.player_team === 'team_b' ? 'text-white font-bold' : 'text-gray-400'}>
                                  {scrim.team_b_score}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                            {scrim.elo_change !== null ? (
                              <span className={`font-semibold ${scrim.elo_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {scrim.elo_change >= 0 ? '+' : ''}{scrim.elo_change}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                            <Link
                              href={`/scrim/${scrim.id}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline text-xs"
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
                <div className="text-lg mb-2">No scrim results found</div>
                <div className="text-sm">This player hasn&apos;t played any ranked scrims in the selected time range.</div>
              </div>
            )}
          </div>

          {/* Sessions Section */}
          <div className="mb-4">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-4">Recent Sessions</h2>

            {/* Time filters */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  <label className="block text-gray-300 text-xs sm:text-sm mb-1">Map</label>
                  <select
                    value={sessionMapFilter}
                    onChange={(e) => setSessionMapFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm"
                  >
                    <option value="">All Maps</option>
                    {scrimMaps.map((map) => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
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
