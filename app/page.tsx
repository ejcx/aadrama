"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ServerDetails from "./components/ServerDetails";
import SidebarLayout from "./components/SidebarLayout";
import PlayerSearch from "./components/PlayerSearch";

interface Server {
  ipAddress: string;
  country: string;
  serverName: string;
  mapName: string;
  currentPlayers: number;
  maxPlayers: number;
}

interface TopPlayer {
  player_name: string;
  total_kills: number;
  total_deaths: number;
  kd_ratio?: number;
  total_games?: number;
}

function kdDisplay(player: TopPlayer): string {
  if (player.kd_ratio !== undefined) return player.kd_ratio.toFixed(2);
  if (player.total_deaths > 0) return (player.total_kills / player.total_deaths).toFixed(2);
  return player.total_kills > 0 ? "∞" : "0.00";
}

const Home = () => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topPlayersLoading, setTopPlayersLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch("https://srvlist.ej.workers.dev");
        const data = await response.json();
        setServers(data);
      } catch (error) {
        console.error("Failed to fetch servers:", error);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  useEffect(() => {
    const fetchTopPlayers = async () => {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        const response = await fetch(
          `https://server-details.ej.workers.dev/analytics/top-players/kills?limit=10&start_time=${encodeURIComponent(startTime.toISOString())}`
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
        console.error("Failed to fetch top players:", error);
        setTopPlayers([]);
      } finally {
        setTopPlayersLoading(false);
      }
    };

    fetchTopPlayers();
  }, []);

  const activeServers = servers
    .filter((server) => server.currentPlayers > 0)
    .sort((a, b) => b.currentPlayers - a.currentPlayers);

  return (
    <SidebarLayout>
      <div className="relative min-h-screen aa-page-bg">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34, 197, 94, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(6, 182, 212, 0.08), transparent)",
          }}
        />

        <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6 md:px-8 py-8 sm:py-10 space-y-10">
          {/* Search */}
          <section>
            <PlayerSearch placeholder="Search a player…" />
          </section>

          {/* Top players */}
          <section>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-white text-lg sm:text-xl font-semibold tracking-tight">
                  Top fragging
                </h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Last 24 hours</p>
              </div>
              <Link
                href="/tracker/top-players"
                className="text-xs sm:text-sm text-cyan-400/90 hover:text-cyan-300 transition-colors"
              >
                Full leaderboard →
              </Link>
            </div>

            {topPlayersLoading ? (
              <div className="h-40 rounded-xl border border-gray-800 bg-gray-900/40 animate-pulse" />
            ) : topPlayers.length > 0 ? (
              <ol className="rounded-xl border border-gray-800 bg-gray-950/60 divide-y divide-gray-800/80 overflow-hidden">
                {topPlayers.map((player, index) => (
                  <li key={player.player_name}>
                    <Link
                      href={`/tracker/player/${encodeURIComponent(player.player_name)}`}
                      className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <span
                        className={`w-7 text-center text-sm font-mono tabular-nums ${
                          index === 0
                            ? "text-amber-400"
                            : index < 3
                              ? "text-gray-300"
                              : "text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="flex-1 min-w-0 text-sm sm:text-base text-white font-medium truncate">
                        {player.player_name}
                      </span>
                      <span className="hidden sm:inline text-xs text-gray-500 tabular-nums w-14 text-right">
                        {kdDisplay(player)} K/D
                      </span>
                      <span className="text-sm font-mono tabular-nums text-emerald-400/90 w-12 text-right">
                        {player.total_kills}
                      </span>
                      <span className="text-sm font-mono tabular-nums text-red-400/70 w-10 text-right">
                        {player.total_deaths}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-sm">No kills logged in the past day.</p>
            )}
          </section>

          {/* Live servers */}
          <section id="servers-25">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-white text-lg sm:text-xl font-semibold tracking-tight">
                  Live servers
                </h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                  {loading
                    ? "Checking…"
                    : `${activeServers.length} online`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl border border-gray-800 bg-gray-900/40 animate-pulse"
                  />
                ))}
              </div>
            ) : activeServers.length > 0 ? (
              <div className="space-y-3">
                {activeServers.map((server) => {
                  const open = expandedServer === server.ipAddress;
                  const fill = Math.min(
                    100,
                    (server.currentPlayers / Math.max(1, server.maxPlayers)) * 100
                  );

                  return (
                    <div
                      key={server.ipAddress}
                      className={`rounded-xl border transition-colors ${
                        open
                          ? "border-cyan-800/60 bg-gray-900/80"
                          : "border-gray-800 bg-gray-950/60 hover:border-gray-700 hover:bg-gray-900/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedServer(open ? null : server.ipAddress)
                        }
                        className="w-full text-left p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                {server.country}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live
                              </span>
                            </div>
                            <h3 className="text-white text-base sm:text-lg font-medium truncate">
                              {server.serverName}
                            </h3>
                            <p className="text-cyan-400/80 text-sm mt-0.5 truncate">
                              {server.mapName}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-white text-sm font-mono tabular-nums">
                              {server.currentPlayers}
                              <span className="text-gray-600">/{server.maxPlayers}</span>
                            </span>
                            <svg
                              className={`w-4 h-4 text-gray-500 transition-transform ${
                                open ? "rotate-180" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500 transition-all duration-500"
                            style={{ width: `${fill}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] font-mono text-gray-600 truncate">
                          {server.ipAddress}
                        </p>
                      </button>

                      {open && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-800/80">
                          <ServerDetails server={server} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center">
                <p className="text-gray-400 text-sm">Nobody online right now</p>
                <p className="text-gray-600 text-xs mt-1">Check back in a bit</p>
              </div>
            )}
          </section>

          <p className="pt-4 text-center text-xs text-gray-600">
            <Link href="/downloads" className="aa-link hover:underline">
              Downloads
            </Link>{" "}
            are available here from time to time.
          </p>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default Home;
