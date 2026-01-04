"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useParams } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import SidebarLayout from "../../components/SidebarLayout";
import { createClient } from "@/lib/supabase/client";
import {
  joinScrim,
  leaveScrim,
  toggleReady,
  endGame,
  submitScore,
  cancelScrim,
  setTrackerSessionId,
  getSessionStats,
  type SessionStats,
} from "../actions";
import type { ScrimWithCounts, ScrimPlayer, ScrimScoreSubmission } from "@/lib/supabase/types";

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "bg-yellow-600 text-yellow-100",
    ready_check: "bg-blue-600 text-blue-100",
    in_progress: "bg-green-600 text-green-100",
    scoring: "bg-purple-600 text-purple-100",
    finalized: "bg-gray-600 text-gray-100",
    expired: "bg-red-900 text-red-200",
    cancelled: "bg-gray-700 text-gray-300",
  };

  const labels: Record<string, string> = {
    waiting: "Waiting for Players",
    ready_check: "Ready Check",
    in_progress: "In Progress",
    scoring: "Awaiting Scores",
    finalized: "Finalized",
    expired: "Expired",
    cancelled: "Cancelled",
  };

  return (
    <span className={`px-3 py-1.5 rounded text-sm font-semibold ${styles[status] || "bg-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

// Countdown timer
function ExpiresIn({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="text-yellow-400 text-lg font-mono">
      ⏱️ Expires in {timeLeft}
    </div>
  );
}

export default function ScrimDetailClient() {
  const params = useParams();
  const scrimId = params.id as string;
  const { user } = useUser();
  const supabase = useMemo(() => createClient(), []);

  const [scrim, setScrim] = useState<ScrimWithCounts | null>(null);
  const [players, setPlayers] = useState<ScrimPlayer[]>([]);
  const [scoreSubmissions, setScoreSubmissions] = useState<ScrimScoreSubmission[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [trackerInput, setTrackerInput] = useState("");

  // Derived state
  const isParticipant = players.some(p => p.user_id === user?.id);
  const isCreator = scrim?.created_by === user?.id;
  const myPlayer = players.find(p => p.user_id === user?.id);

  // Team splits
  const teamA = players.filter(p => p.team === "team_a");
  const teamB = players.filter(p => p.team === "team_b");
  const unassigned = players.filter(p => !p.team);

  useEffect(() => {
    loadScrimData();
    // Poll every 5 seconds for real-time updates
    const interval = setInterval(loadScrimData, 5000);
    return () => clearInterval(interval);
  }, [scrimId]);

  async function loadScrimData() {
    try {
      // Use browser client for read operations (edge runtime compatible)
      const [scrimRes, playersRes] = await Promise.all([
        supabase
          .from('scrims_with_counts')
          .select('*')
          .eq('id', scrimId)
          .single(),
        supabase
          .from('scrim_players')
          .select('*')
          .eq('scrim_id', scrimId)
          .order('joined_at', { ascending: true }),
      ]);

      if (scrimRes.error || !scrimRes.data) {
        setError("Scrim not found");
        return;
      }

      const scrimData = scrimRes.data as ScrimWithCounts;
      setScrim(scrimData);
      setPlayers(playersRes.data || []);

      // Load score submissions if in scoring phase
      if (scrimData.status === "scoring" || scrimData.status === "finalized") {
        const { data: submissions } = await supabase
          .from('scrim_score_submissions')
          .select('*')
          .eq('scrim_id', scrimId);
        setScoreSubmissions(submissions || []);
      }
      
      // Load session stats if tracker link is set
      if (scrimData.tracker_session_id) {
        try {
          const stats = await getSessionStats(scrimData.tracker_session_id);
          setSessionStats(stats);
        } catch (err) {
          console.error("Failed to load session stats:", err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scrim");
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
        await loadScrimData();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-gray-400 text-lg">Loading scrim...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (error || !scrim) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="text-red-400 text-lg">{error || "Scrim not found"}</div>
          <Link href="/scrim" className="text-blue-400 hover:text-blue-300 hover:underline">
            ← Back to Scrims
          </Link>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-12 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/scrim" className="text-blue-400 hover:text-blue-300 hover:underline text-sm">
            ← Back to Scrims
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>

        {/* Scrim Title */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-white text-2xl sm:text-3xl font-bold">
              {scrim.map ? `🗺️ ${scrim.map}` : scrim.title || `Scrim #${scrim.id.slice(0, 8)}`}
            </h1>
            <StatusBadge status={scrim.status} />
          </div>
          <p className="text-gray-400">
            Created by {scrim.created_by_name || "Unknown"} • {new Date(scrim.created_at).toLocaleString()}
          </p>
          {scrim.status === "waiting" && <ExpiresIn expiresAt={scrim.expires_at} />}
        </div>

        {/* Final Score (if finalized) */}
        {scrim.status === "finalized" && scrim.team_a_score !== null && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6 text-center">
            <div className="text-gray-400 text-sm mb-2">Final Score</div>
            <div className="flex items-center justify-center gap-6">
              <div>
                <div className="text-blue-400 text-sm mb-1">Team A</div>
                <div className="text-white text-4xl font-bold">{scrim.team_a_score}</div>
              </div>
              <div className="text-gray-500 text-2xl">-</div>
              <div>
                <div className="text-red-400 text-sm mb-1">Team B</div>
                <div className="text-white text-4xl font-bold">{scrim.team_b_score}</div>
              </div>
            </div>
            {scrim.winner && scrim.winner !== "draw" && (
              <div className="text-green-400 mt-3 text-lg">
                🏆 {scrim.winner === "team_a" ? "Team A" : "Team B"} Wins!
              </div>
            )}
            {scrim.winner === "draw" && (
              <div className="text-yellow-400 mt-3 text-lg">🤝 Draw</div>
            )}
          </div>
        )}

        {/* Session Stats */}
        {scrim.tracker_session_id && sessionStats.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-xl font-semibold">📊 Game Stats</h2>
              <Link
                href={`/tracker/session/${scrim.tracker_session_id}`}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View Full Details →
              </Link>
            </div>
            
            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">Total Kills</div>
                <div className="text-green-400 text-2xl font-bold">
                  {sessionStats.reduce((sum, s) => sum + s.total_kills, 0)}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">Total Deaths</div>
                <div className="text-red-400 text-2xl font-bold">
                  {sessionStats.reduce((sum, s) => sum + s.total_deaths, 0)}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">Players</div>
                <div className="text-white text-2xl font-bold">
                  {new Set(sessionStats.flatMap(s => s.players.map(p => p.name))).size}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-400 text-xs mb-1">Duration</div>
                <div className="text-white text-2xl font-bold">
                  {(() => {
                    const totalSecs = sessionStats.reduce((sum, s) => sum + (s.duration || 0), 0);
                    const mins = Math.floor(totalSecs / 60);
                    return `${mins}m`;
                  })()}
                </div>
              </div>
            </div>
            
            {/* Player Leaderboard */}
            <h3 className="text-gray-300 font-medium mb-2">Player Stats</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2 px-2">Player</th>
                    <th className="text-center py-2 px-2">Kills</th>
                    <th className="text-center py-2 px-2">Deaths</th>
                    <th className="text-center py-2 px-2">K/D</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Aggregate player stats across all sessions
                    const playerMap = new Map<string, { kills: number; deaths: number }>();
                    sessionStats.forEach(s => {
                      s.players.forEach(p => {
                        const existing = playerMap.get(p.name) || { kills: 0, deaths: 0 };
                        playerMap.set(p.name, {
                          kills: existing.kills + p.kills,
                          deaths: existing.deaths + p.deaths,
                        });
                      });
                    });
                    
                    return Array.from(playerMap.entries())
                      .sort((a, b) => b[1].kills - a[1].kills)
                      .slice(0, 16)
                      .map(([name, stats]) => (
                        <tr key={name} className="border-b border-gray-800 hover:bg-gray-800">
                          <td className="py-2 px-2">
                            <Link 
                              href={`/tracker/player/${encodeURIComponent(name)}`}
                              className="text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              {name}
                            </Link>
                          </td>
                          <td className="text-center py-2 px-2 text-green-400">{stats.kills}</td>
                          <td className="text-center py-2 px-2 text-red-400">{stats.deaths}</td>
                          <td className="text-center py-2 px-2 text-gray-300">
                            {stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills > 0 ? '∞' : '0.00'}
                          </td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Tracker Link (no stats yet) */}
        {scrim.tracker_session_id && sessionStats.length === 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-blue-400">📊 Game Stats:</span>
              <Link
                href={`/tracker/session/${scrim.tracker_session_id}`}
                className="text-blue-300 hover:text-blue-200 hover:underline"
              >
                View Full Session Details →
              </Link>
            </div>
          </div>
        )}

        {/* Teams / Waiting Room */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
          {/* Waiting Room */}
          {scrim.status === "waiting" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-4">
                Waiting Room ({players.length}/{scrim.max_players_per_team * 2})
              </h2>
              {unassigned.length > 0 ? (
                <div className="flex flex-wrap gap-3 mb-4">
                  {unassigned.map(p => (
                    <div
                      key={p.id}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        p.is_ready
                          ? "bg-green-800 text-green-200 border border-green-600"
                          : "bg-gray-700 text-gray-300 border border-gray-600"
                      }`}
                    >
                      {p.user_name} {p.is_ready && "✓ Ready"}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 mb-4">No players yet. Be the first to join!</p>
              )}

              {/* Join/Ready actions */}
              <div className="flex flex-wrap gap-3">
                {user && !isParticipant && (
                  <button
                    onClick={() => handleAction(() => joinScrim(scrimId))}
                    disabled={isPending}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    Join Scrim
                  </button>
                )}
                {isParticipant && (
                  <>
                    <button
                      onClick={() => handleAction(() => toggleReady(scrimId))}
                      disabled={isPending}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        myPlayer?.is_ready
                          ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                          : "bg-green-600 hover:bg-green-500 text-white"
                      }`}
                    >
                      {myPlayer?.is_ready ? "Cancel Ready" : "Ready Up"}
                    </button>
                    <button
                      onClick={() => handleAction(() => leaveScrim(scrimId))}
                      disabled={isPending}
                      className="px-6 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg font-medium"
                    >
                      Leave
                    </button>
                  </>
                )}
                {isCreator && (
                  <button
                    onClick={() => handleAction(() => cancelScrim(scrimId))}
                    disabled={isPending}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    Cancel Scrim
                  </button>
                )}
              </div>

              {/* Status messages */}
              {players.length > 0 && players.length % 2 !== 0 && (
                <p className="text-yellow-400 text-sm mt-4">
                  ⚠ Need an even number of players for teams
                </p>
              )}
              {players.length >= 2 && players.every(p => p.is_ready) && players.length % 2 === 0 && (
                <p className="text-green-400 text-sm mt-4">
                  ✓ All players ready! Game will start automatically
                </p>
              )}
            </>
          )}

          {/* Teams (in_progress, scoring, finalized) */}
          {(scrim.status === "in_progress" || scrim.status === "scoring" || scrim.status === "finalized") && (
            <>
              <h2 className="text-white text-xl font-semibold mb-4">Teams</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-blue-400 font-semibold mb-3 text-lg">Team A</h3>
                  <div className="space-y-2">
                    {teamA.map(p => (
                      <div key={p.id} className="bg-blue-900/30 border border-blue-800 rounded px-3 py-2 text-white">
                        {p.user_name}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-red-400 font-semibold mb-3 text-lg">Team B</h3>
                  <div className="space-y-2">
                    {teamB.map(p => (
                      <div key={p.id} className="bg-red-900/30 border border-red-800 rounded px-3 py-2 text-white">
                        {p.user_name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* End Game button */}
              {scrim.status === "in_progress" && isParticipant && (
                <div className="mt-6">
                  <button
                    onClick={() => handleAction(() => endGame(scrimId))}
                    disabled={isPending}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium"
                  >
                    End Game & Submit Scores
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Score Submission */}
        {scrim.status === "scoring" && isParticipant && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-white text-xl font-semibold mb-4">Submit Final Score</h2>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="text-blue-400 text-sm block mb-1">Team A</label>
                <input
                  type="number"
                  min="0"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="w-24 px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                />
              </div>
              <span className="text-gray-500 text-3xl mt-5">-</span>
              <div>
                <label className="text-red-400 text-sm block mb-1">Team B</label>
                <input
                  type="number"
                  min="0"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="w-24 px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center text-lg"
                />
              </div>
              <button
                onClick={() => handleAction(() => submitScore(scrimId, parseInt(scoreA) || 0, parseInt(scoreB) || 0))}
                disabled={isPending || !scoreA || !scoreB}
                className="px-6 py-2 mt-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                Submit
              </button>
            </div>
            <p className="text-gray-400 text-sm">
              Score will be finalized when 2 players submit the same score.
            </p>

            {/* Show existing submissions */}
            {scoreSubmissions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-gray-300 text-sm font-medium mb-2">Submitted Scores:</h3>
                <div className="space-y-1">
                  {scoreSubmissions.map(s => (
                    <div key={s.id} className="text-gray-400 text-sm">
                      {s.user_name}: {s.team_a_score} - {s.team_b_score}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tracker Link Input */}
        {(isParticipant || isCreator) &&
          (scrim.status === "scoring" || scrim.status === "finalized") &&
          !scrim.tracker_session_id && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-white text-xl font-semibold mb-2">Link Tracker Session</h2>
              <p className="text-gray-400 text-sm mb-4">
                Paste session ID(s) from the tracker. Use + to combine multiple sessions.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={trackerInput}
                  onChange={(e) => setTrackerInput(e.target.value)}
                  placeholder="e.g. abc123 or abc123+def456"
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
                <button
                  onClick={() => handleAction(() => setTrackerSessionId(scrimId, trackerInput))}
                  disabled={isPending || !trackerInput.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  Link
                </button>
              </div>
            </div>
          )}

        {/* Share Link */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm mb-2">Share this scrim:</p>
          <code className="text-blue-400 text-sm bg-gray-900 px-3 py-1 rounded">
            {typeof window !== "undefined" ? window.location.href : `/scrim/${scrimId}`}
          </code>
        </div>
      </div>
    </SidebarLayout>
  );
}

