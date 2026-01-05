"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import SidebarLayout from "../components/SidebarLayout";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { 
  createScrim, 
  joinScrim, 
  leaveScrim, 
  toggleReady,
  endGame,
  submitScore,
  cancelScrim,
  setTrackerSessionId,
} from "./actions";
import type { ScrimWithCounts, ScrimPlayer } from "@/lib/supabase/types";

// Scrim status badges
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
    waiting: "Waiting",
    ready_check: "Ready Check",
    in_progress: "In Progress",
    scoring: "Scoring",
    finalized: "Finalized",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || "bg-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}

// Countdown timer for expiration
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
  
  return <span className="text-gray-400 text-sm">Expires: {timeLeft}</span>;
}

// Single scrim card
function ScrimCard({ 
  scrim, 
  userId,
  isLoggedIn,
  onRefresh 
}: { 
  scrim: ScrimWithCounts;
  userId: string | null;
  isLoggedIn: boolean;
  onRefresh: () => void;
}) {
  const [players, setPlayers] = useState<ScrimPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [trackerInput, setTrackerInput] = useState("");
  const supabase = useMemo(() => createClient(), []);
  
  const isParticipant = players.some(p => p.user_id === userId);
  const isCreator = scrim.created_by === userId;
  const myPlayer = players.find(p => p.user_id === userId);
  const allReady = players.length > 0 && players.every(p => p.is_ready);
  const canStart = players.length >= scrim.min_players_per_team * 2 && 
                   players.length % 2 === 0 && 
                   allReady;
  
  // Team assignment display
  const teamA = players.filter(p => p.team === "team_a");
  const teamB = players.filter(p => p.team === "team_b");
  const unassigned = players.filter(p => !p.team);
  
  useEffect(() => {
    if (expanded) {
      loadPlayers();
    }
  }, [expanded, scrim.id]);
  
  async function loadPlayers() {
    try {
      const { data, error } = await supabase
        .from('scrim_players')
        .select('*')
        .eq('scrim_id', scrim.id)
        .order('joined_at', { ascending: true });
      
      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error("Failed to load players:", err);
    }
  }
  
  function handleAction(action: () => Promise<unknown>) {
    setLoading(true);
    startTransition(async () => {
      try {
        await action();
        await loadPlayers();
        onRefresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Action failed");
      } finally {
        setLoading(false);
      }
    });
  }
  
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            {scrim.map && <span className="text-cyan-400">🗺️ {scrim.map}</span>}
            {!scrim.map && (scrim.title || `Scrim #${scrim.id.slice(0, 8)}`)}
          </h3>
          <p className="text-gray-400 text-sm">
            Created by {scrim.created_by_name || "Unknown"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scrim.is_ranked && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">
              Ranked
            </span>
          )}
          <StatusBadge status={scrim.status} />
          {scrim.status === "waiting" && <ExpiresIn expiresAt={scrim.expires_at} />}
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-sm text-gray-300 mb-4">
        <span>👥 {scrim.player_count}/{scrim.max_players_per_team * 2} players</span>
        {scrim.status === "waiting" && (
          <span>✅ {scrim.ready_count} ready</span>
        )}
        {scrim.status === "finalized" && scrim.team_a_score !== null && (
          <span className="text-green-400 font-semibold">
            Final: {scrim.team_a_score} - {scrim.team_b_score}
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {expanded ? "Hide Details" : "Show Details"}
          </button>
          <Link
            href={`/scrim/${scrim.id}`}
            className="text-gray-400 hover:text-gray-300 text-sm"
          >
            Open Full Page →
          </Link>
        </div>
        
        {scrim.status === "waiting" && !isParticipant && (
          isLoggedIn ? (
            <button
              onClick={() => handleAction(() => joinScrim(scrim.id))}
              disabled={loading || isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-medium"
            >
              Join
            </button>
          ) : (
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium">
                Sign in to Join
              </button>
            </SignInButton>
          )
        )}
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          {/* Waiting room players */}
          {scrim.status === "waiting" && unassigned.length > 0 && (
            <div className="mb-4">
              <h4 className="text-white font-medium mb-2">Waiting Room</h4>
              <div className="flex flex-wrap gap-2">
                {unassigned.map(p => (
                  <div 
                    key={p.id}
                    className={`px-3 py-1 rounded text-sm ${
                      p.is_ready 
                        ? "bg-green-800 text-green-200" 
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {p.user_name} {p.is_ready && "✓"}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Team assignments (in_progress or scoring) */}
          {(scrim.status === "in_progress" || scrim.status === "scoring" || scrim.status === "finalized") && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="text-blue-400 font-medium mb-2">Team A</h4>
                <div className="space-y-1">
                  {teamA.map(p => (
                    <div key={p.id} className="text-gray-300 text-sm">
                      {p.user_name}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-red-400 font-medium mb-2">Team B</h4>
                <div className="space-y-1">
                  {teamB.map(p => (
                    <div key={p.id} className="text-gray-300 text-sm">
                      {p.user_name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {/* Leave button */}
            {isParticipant && scrim.status === "waiting" && (
              <button
                onClick={() => handleAction(() => leaveScrim(scrim.id))}
                disabled={loading || isPending}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded text-sm"
              >
                Leave
              </button>
            )}
            
            {/* Ready toggle */}
            {isParticipant && scrim.status === "waiting" && (
              <button
                onClick={() => handleAction(() => toggleReady(scrim.id))}
                disabled={loading || isPending}
                className={`px-3 py-1 rounded text-sm ${
                  myPlayer?.is_ready 
                    ? "bg-yellow-600 hover:bg-yellow-500 text-white" 
                    : "bg-green-600 hover:bg-green-500 text-white"
                }`}
              >
                {myPlayer?.is_ready ? "Unready" : "Ready Up"}
              </button>
            )}
            
            {/* End game */}
            {isParticipant && scrim.status === "in_progress" && (
              <button
                onClick={() => handleAction(() => endGame(scrim.id))}
                disabled={loading || isPending}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded text-sm"
              >
                End Game
              </button>
            )}
            
            {/* Cancel (creator only) */}
            {isCreator && (scrim.status === "waiting" || scrim.status === "ready_check") && (
              <button
                onClick={() => handleAction(() => cancelScrim(scrim.id))}
                disabled={loading || isPending}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded text-sm"
              >
                Cancel
              </button>
            )}
          </div>
          
          {/* Score submission */}
          {isParticipant && scrim.status === "scoring" && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <h4 className="text-white font-medium mb-3">Submit Final Score</h4>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-blue-400 text-sm block mb-1">Team A</label>
                  <input
                    type="number"
                    min="0"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center"
                  />
                </div>
                <span className="text-gray-500 text-2xl mt-5">-</span>
                <div>
                  <label className="text-red-400 text-sm block mb-1">Team B</label>
                  <input
                    type="number"
                    min="0"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center"
                  />
                </div>
                <button
                  onClick={() => handleAction(() => submitScore(scrim.id, parseInt(scoreA) || 0, parseInt(scoreB) || 0))}
                  disabled={loading || isPending || !scoreA || !scoreB}
                  className="px-4 py-2 mt-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded text-sm"
                >
                  Submit
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Score will be finalized when 2 players submit the same score.
              </p>
            </div>
          )}
          
          {/* Tracker link display */}
          {scrim.tracker_session_id && (
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-sm">📊 Game Stats:</span>
                <Link 
                  href={`/tracker/session/${scrim.tracker_session_id}`}
                  className="text-blue-300 hover:text-blue-200 hover:underline text-sm"
                >
                  View Session Details →
                </Link>
              </div>
            </div>
          )}
          
          {/* Tracker link input (scoring/finalized, participants only) */}
          {(isParticipant || isCreator) && 
           (scrim.status === "scoring" || scrim.status === "finalized") && 
           !scrim.tracker_session_id && (
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <h4 className="text-white font-medium mb-2">Link Tracker Session</h4>
              <p className="text-gray-400 text-xs mb-3">
                Paste session ID(s) from the tracker. Use + to combine multiple sessions (e.g. abc123+def456)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackerInput}
                  onChange={(e) => setTrackerInput(e.target.value)}
                  placeholder="e.g. abc123..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
                <button
                  onClick={() => handleAction(() => setTrackerSessionId(scrim.id, trackerInput))}
                  disabled={loading || isPending || !trackerInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm"
                >
                  Link
                </button>
              </div>
            </div>
          )}
          
          {/* Status messages */}
          {scrim.status === "waiting" && canStart && (
            <p className="text-green-400 text-sm mt-4">
              ✓ All players ready! Game will start automatically.
            </p>
          )}
          {scrim.status === "waiting" && players.length > 0 && players.length % 2 !== 0 && (
            <p className="text-yellow-400 text-sm mt-4">
              ⚠ Need an even number of players for teams.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScrimClient() {
  const { user, isLoaded } = useUser();
  const [activeScrims, setActiveScrims] = useState<ScrimWithCounts[]>([]);
  const [recentScrims, setRecentScrims] = useState<ScrimWithCounts[]>([]);
  const [availableMaps, setAvailableMaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedMap, setSelectedMap] = useState("");
  const [isRanked, setIsRanked] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  
  useEffect(() => {
    loadScrims();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadScrims, 10000);
    return () => clearInterval(interval);
  }, []);
  
  async function loadScrims() {
    try {
      // Use browser client for read operations (edge runtime compatible)
      const [activeRes, recentRes, mapsRes] = await Promise.all([
        // Expire stale scrims first, then fetch active
        supabase.rpc('expire_stale_scrims').then(() =>
          supabase
            .from('scrims_with_counts')
            .select('*')
            .in('status', ['waiting', 'ready_check', 'in_progress', 'scoring'])
            .order('created_at', { ascending: false })
        ),
        // Fetch recent scrims
        supabase
          .from('scrims_with_counts')
          .select('*')
          .in('status', ['finalized', 'cancelled', 'expired'])
          .order('created_at', { ascending: false })
          .limit(5),
        // Fetch distinct maps
        supabase.rpc('get_distinct_maps'),
      ]);
      
      setActiveScrims(activeRes.data || []);
      setRecentScrims(recentRes.data || []);
      setAvailableMaps(mapsRes.data?.map((row: { map: string }) => row.map) || []);
    } catch (err) {
      console.error("Failed to load scrims:", err);
    } finally {
      setLoading(false);
    }
  }
  
  function handleCreateScrim() {
    if (!selectedMap) {
      alert("Please select a map");
      return;
    }
    setCreating(true);
    startTransition(async () => {
      try {
        await createScrim({ map: selectedMap, is_ranked: isRanked });
        setSelectedMap("");
        await loadScrims();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to create scrim");
      } finally {
        setCreating(false);
      }
    });
  }
  
  return (
    <SidebarLayout>
      <div className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 py-6 sm:py-12">
        <div className="flex flex-col items-start space-y-6 sm:space-y-8 w-full max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between w-full">
            <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold">
              AA Scrim
            </h1>
            {user ? (
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10"
                  }
                }}
              />
            ) : (
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
          
          {/* Create scrim */}
          <div className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Create New Scrim</h2>
            {user ? (
              <>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <select
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value)}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="">Select a map...</option>
                    {availableMaps.map(map => (
                      <option key={map} value={map}>{map}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateScrim}
                    disabled={creating || isPending || !isLoaded || !selectedMap}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {creating ? "Creating..." : "Create Scrim"}
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRanked}
                    onChange={(e) => setIsRanked(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">Ranked</span>
                  <span className="text-gray-400 text-xs">(ELO tracking)</span>
                </label>
                <p className="text-gray-400 text-sm mt-2">
                  Scrims expire after 20 minutes if not started.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">Sign in to create or join scrims</p>
                <SignInButton mode="modal">
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                    Sign In to Participate
                  </button>
                </SignInButton>
              </div>
            )}
          </div>
          
          {/* Active Scrims */}
          <div className="w-full">
            <h2 className="text-white text-xl font-bold mb-4">Active Scrims</h2>
            {loading ? (
              <div className="text-gray-400">Loading scrims...</div>
            ) : activeScrims.length > 0 ? (
              <div className="space-y-4">
                {activeScrims.map(scrim => (
                  <ScrimCard 
                    key={scrim.id} 
                    scrim={scrim} 
                    userId={user?.id || null}
                    isLoggedIn={!!user}
                    onRefresh={loadScrims}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 border-2 border-dashed border-gray-600 rounded-lg text-center">
                <div className="text-gray-400 text-lg mb-2">No active scrims</div>
                <div className="text-gray-500 text-sm">Create one to get started!</div>
              </div>
            )}
          </div>
          
          {/* Recent Scrims */}
          {recentScrims.length > 0 && (
            <div className="w-full">
              <h2 className="text-white text-xl font-bold mb-4">Recent Scrims</h2>
              <div className="space-y-3">
                {recentScrims.map(scrim => (
                  <Link
                    key={scrim.id}
                    href={`/scrim/${scrim.id}`}
                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {scrim.map && (
                        <span className="text-cyan-400">🗺️ {scrim.map}</span>
                      )}
                      {!scrim.map && (
                        <span className="text-gray-300">
                          {scrim.title || `Scrim #${scrim.id.slice(0, 8)}`}
                        </span>
                      )}
                      <span className="text-gray-500 text-sm">
                        {scrim.player_count} players
                      </span>
                      {scrim.tracker_session_id && (
                        <span className="text-blue-400 text-sm">📊 Stats</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {scrim.status === "finalized" && scrim.team_a_score !== null && (
                        <span className="text-green-400 font-mono">
                          {scrim.team_a_score} - {scrim.team_b_score}
                        </span>
                      )}
                      <StatusBadge status={scrim.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}

