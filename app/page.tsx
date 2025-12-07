"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import ServerDetails from "./components/ServerDetails";
import SidebarLayout from "./components/SidebarLayout";

interface Server {
  ipAddress: string;
  country: string;
  serverName: string;
  mapName: string;
  currentPlayers: number;
  maxPlayers: number;
}

interface ServerInfo {
  server_name: string;
  map_name: string;
  game_mode: string;
  players: number;
  max_players: number;
  player_list: Array<{
    name: string;
    ping: number;
    kills: number;
    deaths: number;
    honor: number;
  }>;
  version: string;
  password: boolean;
  ping: string;
}

interface TopPlayer {
  player_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio?: number;
  total_games?: number;
}

const Home = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [engineerServerInfo, setEngineerServerInfo] = useState<ServerInfo | null>(null);
  const [engineerServerLoading, setEngineerServerLoading] = useState(true);
  const [engineerServerExpanded, setEngineerServerExpanded] = useState(false);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topPlayersLoading, setTopPlayersLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch('https://srvlist.ej.workers.dev');
        const data = await response.json();
        setServers(data);
      } catch (error) {
        console.error('Failed to fetch servers:', error);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  useEffect(() => {
    const fetchEngineerServer = async () => {
      try {
        const response = await fetch('https://server-details.ej.workers.dev/query?host=aa-usa.ddns.net&port=7778');
        const data = await response.json();

        if (data.success && data.server_info) {
          setEngineerServerInfo(data.server_info);
        } else {
          setEngineerServerInfo(null);
        }
      } catch (error) {
        console.error('Failed to fetch engineer server:', error);
        setEngineerServerInfo(null);
      } finally {
        setEngineerServerLoading(false);
      }
    };

    fetchEngineerServer();
  }, []);

  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        // Get timestamp for 24 hours ago
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        const startTimeISO = startTime.toISOString();
        
        const response = await fetch(
          `https://server-details.ej.workers.dev/analytics/top-players/kills?limit=10&start_time=${encodeURIComponent(startTimeISO)}`
        );
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setTopPlayers(data);
        } else if (data.players && Array.isArray(data.players)) {
          setTopPlayers(data.players);
        } else {
          setTopPlayers([]);
        }
      } catch (error) {
        console.error('Failed to fetch top players:', error);
        setTopPlayers([]);
      } finally {
        setTopPlayersLoading(false);
      }
    };

    fetchTopPlayers();
  }, []);

  const calculateFragRate = (kills: number, deaths: number): number => {
    if (deaths === 0) return 0;
    return Number((kills / deaths).toFixed(2));
  };

  const calculateScore = (kills: number, deaths: number): number => {
    return kills * 10 - deaths * 10;
  };

  const activeServers = servers.filter(server => server.currentPlayers > 0);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <SidebarLayout>
        <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-12">
          <div className="flex flex-col items-start space-y-6 sm:space-y-8 w-full max-w-4xl">
            <div className="flex flex-col items-start space-y-4 sm:space-y-6 w-full">
              <div className="flex items-center space-x-3 sm:space-x-4 w-full">
                <Image
                  src="/aa.jpg"
                  alt="aa"
                  width={80}
                  height={80}
                  className="rounded-lg w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20"
                />
                <h1 className="text-white text-xl sm:text-2xl md:text-3xl font-bold">Americas Army Competitive Community</h1>
              </div>
              <div className="w-full">
                <p className="text-white text-sm sm:text-base md:text-lg leading-relaxed">
                  A group of competitive players is scrimming regularly. Email discord@aadrama.com with subject "AADrama" and your old AA / AADrama name for a Discord invite.
                </p>
              </div>
            </div>

            <div className="w-full">
              <h2 className="text-white text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Top Players (Past 24 Hours)</h2>
              
              {topPlayersLoading ? (
                <div className="text-white mb-6 sm:mb-8">Loading top players...</div>
              ) : topPlayers.length > 0 ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 sm:p-6 mb-6 sm:mb-8">
                  <div className="overflow-x-auto">
                    <table className="w-full text-white text-xs sm:text-sm min-w-[350px]">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-1 sm:px-2">Rank</th>
                          <th className="text-left py-2 px-1 sm:px-2">Player</th>
                          <th className="text-center py-2 px-1 sm:px-2">Kills</th>
                          <th className="text-center py-2 px-1 sm:px-2">Deaths</th>
                          <th className="text-center py-2 px-1 sm:px-2">K/D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPlayers.map((player, index) => (
                          <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                            <td className="py-2 px-1 sm:px-2 text-gray-400">#{index + 1}</td>
                            <td className="py-2 px-1 sm:px-2">
                              <Link
                                href={`/tracker/player/${encodeURIComponent(player.player_name)}`}
                                className="font-medium text-blue-400 hover:text-blue-300 hover:underline truncate block max-w-[100px] sm:max-w-none"
                              >
                                {player.player_name}
                              </Link>
                            </td>
                          <td className="text-center py-2 px-1 sm:px-2 text-green-400">{player.total_kills}</td>
                          <td className="text-center py-2 px-1 sm:px-2 text-red-400">{player.total_deaths}</td>
                          <td className="text-center py-2 px-1 sm:px-2">
                              {player.kd_ratio !== undefined 
                                ? player.kd_ratio.toFixed(2)
                                : player.total_deaths > 0 
                                  ? (player.total_kills / player.total_deaths).toFixed(2)
                                  : player.total_kills > 0 ? '∞' : '0.00'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 mb-6 sm:mb-8">No player data available for the past 24 hours.</div>
              )}
            </div>

            <div className="w-full">
              <h2 id="servers-25" className="text-white text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Active Servers (AA 2.5)</h2>

              {loading ? (
                <div className="text-white">Loading servers...</div>
              ) : activeServers.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {activeServers.map((server, index) => (
                <div
                  key={index}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold text-sm sm:text-base">{server.country}</span>
                      <span className="px-2 py-0.5 sm:py-1 bg-green-600 text-white text-xs rounded-full">
                        ONLINE
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-white font-mono text-xs sm:text-sm break-all">{server.ipAddress}</div>
                    </div>
                  </div>

                  <h3 className="text-white text-base sm:text-lg font-medium mb-2 break-words">{server.serverName}</h3>
                  <p className="text-gray-300 text-xs sm:text-sm mb-3">Map: {server.mapName}</p>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-gray-300 text-xs sm:text-sm">
                        {server.currentPlayers}/{server.maxPlayers} players
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedServer(expandedServer === server.ipAddress ? null : server.ipAddress)}
                      className="text-gray-400 cursor-pointer hover:text-white transition-colors"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedServer === server.ipAddress ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {expandedServer === server.ipAddress && (
                    <ServerDetails server={server} />
                  )}
                </div>
                  ))}
                  </div>
                ) : (
                    <div className="py-8 sm:py-12 border-2 border-dashed border-gray-600 rounded-lg text-center px-4">
                  <div className="text-gray-400 text-lg sm:text-xl mb-2">Nobody is online right now</div>
                  <div className="text-gray-500 text-xs sm:text-sm">Check back later for active servers</div>
                </div>
              )}
            </div>

            <div className="w-full mt-6 sm:mt-8">
              <h2 id="servers-23" className="text-white text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Active Servers (AA 2.3)</h2>

              {engineerServerLoading ? (
                <div className="text-white">Loading server...</div>
              ) : engineerServerInfo ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 hover:bg-gray-800 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold text-sm sm:text-base">USA</span>
                      <span className="px-2 py-0.5 sm:py-1 bg-green-600 text-white text-xs rounded-full">
                        ONLINE
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-white font-mono text-xs sm:text-sm">aa-usa.ddns.net:1716</div>
                    </div>
                  </div>

                    <h3 className="text-white text-base sm:text-lg font-medium mb-2 break-words">
                      {engineerServerInfo.server_name || "Engineer's Server"}
                    </h3>
                    <p className="text-gray-300 text-xs sm:text-sm mb-3">Map: {engineerServerInfo.map_name}</p>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-gray-300 text-xs sm:text-sm">
                          {engineerServerInfo.players}/{engineerServerInfo.max_players} players
                        </span>
                      </div>
                      <button
                        onClick={() => setEngineerServerExpanded(!engineerServerExpanded)}
                        className="text-gray-400 cursor-pointer hover:text-white transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 transform transition-transform ${engineerServerExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {engineerServerExpanded && (
                      <div className="mt-4 border-t border-gray-700 pt-4">
                        <div className="space-y-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-white text-xs sm:text-sm min-w-[450px]">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="text-left py-2 px-1 sm:px-2">Player</th>
                                  <th className="text-center py-2 px-1 sm:px-2">Ping</th>
                                  <th className="text-center py-2 px-1 sm:px-2">Kills</th>
                                  <th className="text-center py-2 px-1 sm:px-2">Deaths</th>
                                  <th className="text-center py-2 px-1 sm:px-2">Frag Rate</th>
                                  <th className="text-center py-2 px-1 sm:px-2">Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {engineerServerInfo.player_list.map((player, index) => (
                                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                                    <td className="py-2 px-1 sm:px-2">
                                      <Link
                                        href={`/tracker/player/${encodeURIComponent(player.name)}`}
                                        className="font-medium text-blue-400 hover:text-blue-300 hover:underline truncate block max-w-[100px] sm:max-w-none"
                                      >
                                        [{player.honor}] {player.name}
                                      </Link>
                                    </td>
                                    <td className="text-center py-2 px-1 sm:px-2">
                                      <span className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${player.ping < 50 ? 'bg-green-600' :
                                        player.ping < 100 ? 'bg-yellow-600' :
                                          player.ping < 150 ? 'bg-orange-600' : 'bg-red-600'
                                        }`}>
                                        {player.ping}ms
                                      </span>
                                    </td>
                                    <td className="text-center py-2 px-1 sm:px-2 text-green-400">{player.kills}</td>
                                    <td className="text-center py-2 px-1 sm:px-2 text-red-400">{player.deaths}</td>
                                    <td className="text-center py-2 px-1 sm:px-2">
                                      <span className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${calculateFragRate(player.kills, player.deaths) > 1 ? 'bg-green-600' :
                                        calculateFragRate(player.kills, player.deaths) > 0.5 ? 'bg-yellow-600' :
                                          'bg-red-600'
                                        }`}>
                                        {calculateFragRate(player.kills, player.deaths)}
                                      </span>
                                    </td>
                                    <td className="text-center py-2 px-1 sm:px-2">
                                      <span className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs ${calculateScore(player.kills, player.deaths) > 0 ? 'bg-green-600' :
                                        calculateScore(player.kills, player.deaths) < 0 ? 'bg-red-600' : 'bg-gray-600'
                                        }`}>
                                        {calculateScore(player.kills, player.deaths)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="rounded-lg">
                            <div className="text-xs sm:text-sm text-gray-300">
                              <div>Mode: {engineerServerInfo.game_mode}</div>
                              <div>Ping: {engineerServerInfo.ping}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                    <div className="py-8 sm:py-12 border-2 border-dashed border-gray-600 rounded-lg text-center px-4">
                      <div className="text-gray-400 text-lg sm:text-xl mb-2">Engineer's Server isn't available</div>
                  <div className="text-gray-500 text-xs sm:text-sm">Check back later</div>
                </div>
              )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Home;
