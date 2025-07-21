"use client";
import Image from "next/image";
import { useState, useEffect } from "react";

interface Server {
  ipAddress: string;
  country: string;
  serverName: string;
  mapName: string;
  currentPlayers: number;
  maxPlayers: number;
}

const Home = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

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

  const activeServers = servers.filter(server => server.currentPlayers > 0);

  return (
    <div className="flex flex-col w-full min-h-screen items-center justify-center bg-black px-8 py-12">
      <div className="flex flex-col items-center space-y-8 max-w-4xl">
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/aa.jpg"
            alt="aa"
            width={400}
            height={400}
            className="rounded-lg shadow-2xl"
          />
          <div className="text-left max-w-xl">
            <p className="text-white text-lg leading-relaxed">
              AA is back. <br /><br />
              If you're on aadrama dot com then you'd probably be interested to know that a group of old
              competitive players are scrimming regularly.
              <br /><br />
              Email discord@aadrama.com with subject "AADrama" and what your old AA / AADrama name was if you'd like an invite to the discord server.
            </p>
          </div>
        </div>

        <div className="w-full max-w-4xl">
          <h2 className="text-white text-2xl font-bold mb-6 text-center">Active Servers</h2>

          {loading ? (
            <div className="text-white text-center">Loading servers...</div>
          ) : activeServers.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {activeServers.map((server, index) => (
                <div key={index} className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:bg-gray-800 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-semibold">{server.country}</span>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                        ONLINE
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-mono text-sm">{server.ipAddress}</div>
                    </div>
                  </div>

                  <h3 className="text-white text-lg font-medium mb-2">{server.serverName}</h3>
                  <p className="text-gray-300 text-sm mb-3">Map: {server.mapName}</p>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-gray-300 text-sm">
                        {server.currentPlayers}/{server.maxPlayers} players
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-xl mb-2">Nobody is online right now</div>
              <div className="text-gray-500 text-sm">Check back later for active servers</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
