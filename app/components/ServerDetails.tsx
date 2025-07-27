"use client";
import { useState, useEffect } from "react";

interface Player {
  name: string;
  ping: number;
  kills: number;
  deaths: number;
  honor: number;
}

interface ServerInfo {
  server_name: string;
  map_name: string;
  game_mode: string;
  players: number;
  max_players: number;
  player_list: Player[];
  version: string;
  password: boolean;
  ping: string;
}

interface ServerDetailsProps {
  server: {
    ipAddress: string;
    country: string;
    serverName: string;
    mapName: string;
    currentPlayers: number;
    maxPlayers: number;
  };
}

const ServerDetails = ({ server }: ServerDetailsProps) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServerDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Extract host and port from IP address
        const [host, port] = server.ipAddress.split(':');
        const url = `https://server-details.ej.workers.dev/query?host=${host}&port=${port}`;
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
        });
        const data = await response.json();
        
        if (data.success && data.server_info) {
          setServerInfo(data.server_info);
        } else {
          setError('Failed to fetch server details or server is offline');
        }
      } catch (err) {
        console.error('Error fetching server details:', err);
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    };

    fetchServerDetails();
  }, [server.ipAddress]);

  const calculateFragRate = (kills: number, deaths: number): number => {
    if (deaths === 0) return 0;
    return Number((kills / deaths).toFixed(2));
  };

  const calculateScore = (kills: number, deaths: number): number => {
    return kills * 10 - deaths * 10;
  };

  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      {loading && (
        <div className="flex items-center justify-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          <span className="text-white">Loading server details...</span>
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <div className="text-red-400 text-sm mb-2">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {serverInfo && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-white text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2">Player</th>
                  <th className="text-center py-2 px-2">Ping</th>
                  <th className="text-center py-2 px-2">Kills</th>
                  <th className="text-center py-2 px-2">Deaths</th>
                  <th className="text-center py-2 px-2">Frag Rate</th>
                  <th className="text-center py-2 px-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {serverInfo.player_list.map((player, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="py-2 px-2">
                      <span className="font-medium">[{player.honor}] {player.name}</span>
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        player.ping < 50 ? 'bg-green-600' :
                        player.ping < 100 ? 'bg-yellow-600' :
                        player.ping < 150 ? 'bg-orange-600' : 'bg-red-600'
                      }`}>
                        {player.ping}ms
                      </span>
                    </td>
                    <td className="text-center py-2 px-2 text-green-400">{player.kills}</td>
                    <td className="text-center py-2 px-2 text-red-400">{player.deaths}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        calculateFragRate(player.kills, player.deaths) > 1 ? 'bg-green-600' :
                        calculateFragRate(player.kills, player.deaths) > 0.5 ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}>
                        {calculateFragRate(player.kills, player.deaths)}
                      </span>
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        calculateScore(player.kills, player.deaths) > 0 ? 'bg-green-600' :
                        calculateScore(player.kills, player.deaths) < 0 ? 'bg-red-600' : 'bg-gray-600'
                      }`}>
                        {calculateScore(player.kills, player.deaths)}
                      </span>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          <div className="rounded-lg">
            <div className="text-sm text-gray-300">
              <div>Mode: {serverInfo.game_mode}</div>
              <div>Ping: {serverInfo.ping}</div>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerDetails; 