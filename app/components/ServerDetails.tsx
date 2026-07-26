"use client";
import { useState, useEffect } from "react";
import { LiveServerPlayers } from "./LiveServerPlayers";
import { enrichLiveServerInfo, type LiveServerInfo } from "@/lib/server-query";

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
  const [serverInfo, setServerInfo] = useState<LiveServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServerDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const [host, port] = server.ipAddress.split(":");
        const url = `https://server-details.ej.workers.dev/query?host=${host}&port=${port}`;

        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        });
        const data = await response.json();

        if (data.success && data.server_info) {
          setServerInfo(enrichLiveServerInfo(data.server_info));
        } else {
          setError("Failed to fetch server details or server is offline");
        }
      } catch (err) {
        console.error("Error fetching server details:", err);
        setError("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchServerDetails();
  }, [server.ipAddress]);

  return (
    <div>
      {loading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="h-5 w-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="text-gray-400 text-sm">Loading roster…</span>
        </div>
      )}

      {error && (
        <div className="text-center py-6">
          <p className="text-red-400/90 text-sm mb-3">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {serverInfo && <LiveServerPlayers serverInfo={serverInfo} />}
    </div>
  );
};

export default ServerDetails;
