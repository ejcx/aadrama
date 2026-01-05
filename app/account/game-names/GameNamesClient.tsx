"use client";

import { useState, useEffect, useTransition } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import SidebarLayout from "../../components/SidebarLayout";
import { getMyEloStats, addGameName, deleteGameName } from "../actions";
import type { UserGameName, PlayerElo, EloHistory } from "@/lib/supabase/types";

type GameNameWithElo = UserGameName & { elo: PlayerElo | null; recent_history: EloHistory[] };

// ELO change indicator
function EloChange({ change }: { change: number }) {
  if (change === 0) return <span className="text-gray-400">±0</span>;
  if (change > 0) return <span className="text-green-400">+{change}</span>;
  return <span className="text-red-400">{change}</span>;
}

export default function GameNamesClient() {
  const [names, setNames] = useState<GameNameWithElo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGameName, setNewGameName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadNames();
  }, []);

  async function loadNames() {
    try {
      const data = await getMyEloStats();
      setNames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    if (!newGameName.trim()) return;

    startTransition(async () => {
      try {
        await addGameName({ game_name: newGameName.trim() });
        setNewGameName("");
        await loadNames();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to add name");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this name?")) return;

    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteGameName(id);
        await loadNames();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete");
      } finally {
        setDeletingId(null);
      }
    });
  }

  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="flex flex-col items-start space-y-6 sm:space-y-8 w-full max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <div>
              <Link href="/account" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
                ← Back to Account
              </Link>
              <h1 className="text-white text-2xl sm:text-3xl font-bold">
                Game Names
              </h1>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>

          {/* Add new name */}
          <div className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Add In-Game Name</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Enter your in-game name..."
                maxLength={50}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAdd}
                disabled={isPending || !newGameName.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {isPending ? "Adding..." : "Add Name"}
              </button>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Link your in-game name to participate in ranked scrims and track your ELO.
            </p>
          </div>

          {/* Connected names with ELO */}
          <div className="w-full">
            <h2 className="text-white text-xl font-bold mb-4">Your Names & ELO</h2>
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : names.length > 0 ? (
              <div className="space-y-4">
                {names.map((name) => (
                  <div
                    key={name.id}
                    className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-white font-semibold text-xl">{name.game_name}</div>
                        <div className="text-gray-400 text-sm">
                          Added {new Date(name.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(name.id)}
                        disabled={deletingId === name.id}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm font-medium self-start"
                      >
                        {deletingId === name.id ? "Removing..." : "Remove"}
                      </button>
                    </div>

                    {/* ELO Stats */}
                    {name.elo ? (
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex flex-wrap items-center gap-6 mb-4">
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wide">ELO</div>
                            <div className="text-3xl font-bold text-white">{name.elo.elo}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wide">Games</div>
                            <div className="text-xl font-semibold text-white">{name.elo.games_played}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wide">W/L/D</div>
                            <div className="text-lg text-white">
                              <span className="text-green-400">{name.elo.wins}</span>
                              {" / "}
                              <span className="text-red-400">{name.elo.losses}</span>
                              {" / "}
                              <span className="text-gray-400">{name.elo.draws}</span>
                            </div>
                          </div>
                          {name.elo.games_played > 0 && (
                            <div>
                              <div className="text-gray-400 text-xs uppercase tracking-wide">Win Rate</div>
                              <div className="text-lg text-white">
                                {Math.round((name.elo.wins / name.elo.games_played) * 100)}%
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Recent History */}
                        {name.recent_history.length > 0 && (
                          <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wide mb-2">Recent Matches</div>
                            <div className="space-y-1">
                              {name.recent_history.map((h) => (
                                <div
                                  key={h.id}
                                  className="flex items-center justify-between text-sm py-1 border-b border-gray-700 last:border-0"
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-12 text-center py-0.5 rounded text-xs font-semibold ${
                                        h.result === "win"
                                          ? "bg-green-900 text-green-300"
                                          : h.result === "loss"
                                          ? "bg-red-900 text-red-300"
                                          : "bg-gray-700 text-gray-300"
                                      }`}
                                    >
                                      {h.result.toUpperCase()}
                                    </span>
                                    <span className="text-gray-400">
                                      {h.team_score} - {h.opponent_score}
                                    </span>
                                    {h.kills !== null && (
                                      <span className="text-gray-500 text-xs">
                                        ({h.kills}K / {h.deaths}D)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <EloChange change={h.elo_change} />
                                    <span className="text-gray-500 text-xs">
                                      → {h.elo_after}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="text-gray-400 text-sm">
                          No ranked games yet. Play in a ranked scrim to start building your ELO!
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          Starting ELO: 1200
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 border-2 border-dashed border-gray-600 rounded-lg text-center">
                <div className="text-gray-400 text-lg mb-2">No names added yet</div>
                <div className="text-gray-500 text-sm">
                  Add your in-game name to participate in ranked scrims
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
