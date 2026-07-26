"use client";

import { useState, useEffect, useTransition } from "react";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import SidebarLayout from "../components/SidebarLayout";
import Link from "next/link";
import {
  createKothMatch,
  joinKothTeam,
  leaveKothMatch,
  toggleKothReady,
  tryStartKothMatchIfReady,
  endKothMatch,
  submitKothScore,
  cancelKothMatch,
  setKothTeamName,
  getActiveKothMatches,
  getRecentKothMatches,
  getKothMatchPlayers,
} from "./actions";
import { getKothMapsForFormat } from "@/lib/koth/maps";
import { formatLabel, playersPerTeam, type KothFormat } from "@/lib/koth/format";
import type { KothMatchWithCounts, KothMatchPlayer } from "@/lib/supabase/types";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "bg-yellow-600 text-yellow-100",
    in_progress: "bg-green-600 text-green-100",
    scoring: "bg-purple-600 text-purple-100",
    finalized: "bg-gray-600 text-gray-100",
    expired: "bg-red-900 text-red-200",
    cancelled: "bg-gray-700 text-gray-300",
  };
  const labels: Record<string, string> = {
    waiting: "Waiting",
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

function MatchCard({
  match,
  userId,
  isLoggedIn,
  onRefresh,
}: {
  match: KothMatchWithCounts;
  userId: string | null;
  isLoggedIn: boolean;
  onRefresh: () => void;
}) {
  const [players, setPlayers] = useState<KothMatchPlayer[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [challengeName, setChallengeName] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const format = match.format as KothFormat;
  const capacity = playersPerTeam(format);
  const isParticipant = players.some((p) => p.user_id === userId);
  const isCreator = match.created_by === userId;
  const myPlayer = players.find((p) => p.user_id === userId);
  const teamA = players.filter((p) => p.team === "team_a");
  const teamB = players.filter((p) => p.team === "team_b");
  const teamAOpen = teamA.length < capacity;
  const teamBOpen = teamB.length < capacity;
  const allReady = players.length > 0 && players.every((p) => p.is_ready);

  useEffect(() => {
    if (expanded) loadPlayers();
  }, [expanded, match.id, match.status]);

  useEffect(() => {
    if (!expanded || match.status !== "waiting") return;
    const interval = setInterval(loadPlayers, 5000);
    return () => clearInterval(interval);
  }, [expanded, match.status, match.id]);

  async function loadPlayers() {
    try {
      const data = await getKothMatchPlayers(match.id);
      setPlayers(data);

      const needed = capacity * 2;
      const everyoneReady = data.length === needed && data.every((p) => p.is_ready);
      const aFull = data.filter((p) => p.team === "team_a").length === capacity;
      const bFull = data.filter((p) => p.team === "team_b").length === capacity;

      if (match.status === "waiting" && everyoneReady && aFull && bFull) {
        try {
          await tryStartKothMatchIfReady(match.id);
          onRefresh();
          setPlayers(await getKothMatchPlayers(match.id));
        } catch (err) {
          console.error(`[KotH ${match.id}] Auto-start failed:`, err);
        }
      }
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
    <div className="aa-table-wrap">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-amber-400 font-semibold">{formatLabel(format)}</span>
          <span className="text-cyan-400">{match.map}</span>
          <span className="text-white font-medium">
            {match.team_a_name}{" "}
            <span className="text-gray-500">vs</span>{" "}
            {match.team_b_name}
          </span>
          <span className="text-gray-500 text-sm">
            {match.player_count}/{capacity * 2} · {match.ready_count} ready
          </span>
        </div>
        <div className="flex items-center gap-3">
          {match.status === "waiting" && <ExpiresIn expiresAt={match.expires_at} />}
          {match.status === "finalized" && match.team_a_score !== null && (
            <span className="text-green-400 font-mono">
              {match.team_a_score} - {match.team_b_score}
            </span>
          )}
          <StatusBadge status={match.status} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TeamPanel
              title={match.team_a_name}
              players={teamA}
              capacity={capacity}
              open={match.status === "waiting" && teamAOpen}
              canJoin={isLoggedIn && !isParticipant && match.status === "waiting" && teamAOpen}
              onJoin={() => handleAction(() => joinKothTeam(match.id, "team_a"))}
              loading={loading || isPending}
            />
            <TeamPanel
              title={match.team_b_name}
              players={teamB}
              capacity={capacity}
              open={match.status === "waiting" && teamBOpen}
              canJoin={isLoggedIn && !isParticipant && match.status === "waiting" && teamBOpen}
              joinLabel={teamB.length === 0 ? "Challenge" : "Join"}
              showNameInput={
                match.status === "waiting" && teamBOpen && !isParticipant && teamB.length === 0
              }
              nameValue={challengeName}
              onNameChange={setChallengeName}
              onJoin={() =>
                handleAction(() =>
                  joinKothTeam(match.id, "team_b", challengeName.trim() || undefined)
                )
              }
              loading={loading || isPending}
            />
          </div>

          {isParticipant && (match.status === "waiting" || match.status === "in_progress") && (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-gray-400 text-xs mb-1">Rename your team</label>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={myPlayer?.team === "team_a" ? match.team_a_name : match.team_b_name}
                  maxLength={32}
                  className="w-full px-3 py-2 aa-input text-sm"
                />
              </div>
              <button
                type="button"
                disabled={!renameValue.trim() || loading || isPending}
                onClick={() => handleAction(() => setKothTeamName(match.id, renameValue))}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-sm"
              >
                Save Name
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isLoggedIn && isParticipant && match.status === "waiting" && (
              <button
                type="button"
                disabled={loading || isPending}
                onClick={() => handleAction(() => toggleKothReady(match.id))}
                className={`px-4 py-2 rounded font-medium text-sm ${
                  myPlayer?.is_ready
                    ? "bg-green-700 hover:bg-green-600 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {myPlayer?.is_ready ? "Unready" : "Ready Up"}
              </button>
            )}
            {isLoggedIn && isParticipant && match.status === "waiting" && (
              <button
                type="button"
                disabled={loading || isPending}
                onClick={() => handleAction(() => leaveKothMatch(match.id))}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                Leave
              </button>
            )}
            {isCreator && match.status === "waiting" && (
              <button
                type="button"
                disabled={loading || isPending}
                onClick={() => handleAction(() => cancelKothMatch(match.id))}
                className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded text-sm"
              >
                Cancel
              </button>
            )}
            {isParticipant && match.status === "in_progress" && (
              <button
                type="button"
                disabled={loading || isPending}
                onClick={() => handleAction(() => endKothMatch(match.id))}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium"
              >
                End Match → Score
              </button>
            )}
            {!isLoggedIn && match.status === "waiting" && (
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                  Sign in to join
                </button>
              </SignInButton>
            )}
          </div>

          {match.status === "waiting" && allReady && teamA.length === capacity && teamB.length === capacity && (
            <p className="text-green-400 text-sm">Everyone is ready — starting match…</p>
          )}

          {match.status === "in_progress" && (
            <p className="text-amber-300 text-sm">
              Fight on <span className="font-semibold text-cyan-300">{match.map}</span>. Ready when
              finished to submit scores.
            </p>
          )}

          {match.status === "scoring" && isParticipant && (
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{match.team_a_name}</label>
                <input
                  type="number"
                  min={0}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="w-24 px-3 py-2 aa-input"
                />
              </div>
              <span className="text-gray-500 pb-2">–</span>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{match.team_b_name}</label>
                <input
                  type="number"
                  min={0}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="w-24 px-3 py-2 aa-input"
                />
              </div>
              <button
                type="button"
                disabled={loading || isPending || scoreA === "" || scoreB === ""}
                onClick={() =>
                  handleAction(async () => {
                    const result = await submitKothScore(
                      match.id,
                      parseInt(scoreA, 10),
                      parseInt(scoreB, 10)
                    );
                    if (result.finalized) {
                      alert("Score locked — team ELO updated.");
                    }
                  })
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm font-medium"
              >
                Submit Score
              </button>
              <span className="text-gray-500 text-xs pb-2">
                Needs 2 matching submissions ({match.score_submission_count} so far)
              </span>
            </div>
          )}

          <Link href={`/koth/${match.id}`} className="aa-link text-sm hover:underline">
            Open match page →
          </Link>
        </div>
      )}
    </div>
  );
}

function TeamPanel({
  title,
  players,
  capacity,
  open,
  canJoin,
  onJoin,
  loading,
  joinLabel = "Join",
  showNameInput,
  nameValue,
  onNameChange,
}: {
  title: string;
  players: KothMatchPlayer[];
  capacity: number;
  open: boolean;
  canJoin: boolean;
  onJoin: () => void;
  loading: boolean;
  joinLabel?: string;
  showNameInput?: boolean;
  nameValue?: string;
  onNameChange?: (v: string) => void;
}) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        <span className="text-gray-500 text-xs">
          {players.length}/{capacity}
        </span>
      </div>
      <ul className="space-y-1 mb-3 min-h-[2rem]">
        {players.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-200">{p.user_name}</span>
            {p.is_ready ? (
              <span className="text-green-400 text-xs">Ready</span>
            ) : (
              <span className="text-gray-500 text-xs">Not ready</span>
            )}
          </li>
        ))}
        {Array.from({ length: Math.max(0, capacity - players.length) }).map((_, i) => (
          <li key={`empty-${i}`} className="text-gray-600 text-sm italic">
            Open slot
          </li>
        ))}
      </ul>
      {showNameInput && onNameChange && (
        <input
          value={nameValue || ""}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your team name"
          maxLength={32}
          className="w-full mb-2 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white text-sm"
        />
      )}
      {canJoin && (
        <button
          type="button"
          disabled={loading || !open}
          onClick={onJoin}
          className="w-full px-3 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded text-sm font-medium"
        >
          {joinLabel}
        </button>
      )}
    </div>
  );
}

export default function KothClient() {
  const { user, isLoaded } = useUser();
  const [activeMatches, setActiveMatches] = useState<KothMatchWithCounts[]>([]);
  const [recentMatches, setRecentMatches] = useState<KothMatchWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [format, setFormat] = useState<KothFormat>(1);
  const [map, setMap] = useState<string>("Pool Day");
  const [teamName, setTeamName] = useState("");
  const availableMaps = getKothMapsForFormat(format);

  useEffect(() => {
    if (!availableMaps.includes(map)) {
      setMap(availableMaps[0]);
    }
  }, [format, availableMaps, map]);

  useEffect(() => {
    loadMatches();
    const interval = setInterval(loadMatches, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMatches() {
    try {
      const [active, recent] = await Promise.all([
        getActiveKothMatches(),
        getRecentKothMatches(25),
      ]);
      setActiveMatches(active);
      setRecentMatches(recent);
    } catch (err) {
      console.error("Failed to load KotH matches:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    if (!teamName.trim() || !map) return;
    setCreating(true);
    startTransition(async () => {
      try {
        await createKothMatch({ format, map, teamName: teamName.trim() });
        setTeamName("");
        await loadMatches();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to create match");
      } finally {
        setCreating(false);
      }
    });
  }

  return (
    <SidebarLayout>
      <div className="aa-page-bg relative min-h-screen">
        <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="aa-section-title text-2xl sm:text-3xl">King of the Hill</h1>
              <p className="aa-section-sub">
                Preset-map team fights. Rankings under{" "}
                <Link href="/tracker/koth" className="aa-link hover:underline">
                  Tracker → King of the Hill
                </Link>
                .
              </p>
            </div>
            {isLoaded &&
              (user ? (
                <UserButton
                  afterSignOutUrl="/koth"
                  appearance={{
                    elements: { avatarBox: "w-9 h-9" },
                  }}
                />
              ) : (
                <SignInButton mode="modal">
                  <button className="aa-btn-primary">
                    Sign In
                  </button>
                </SignInButton>
              ))}
          </div>

          <div className="w-full aa-panel p-4 sm:p-6">
            <h2 className="text-white font-semibold mb-4">Start a Match</h2>
            {user ? (
              <div className="space-y-4">
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Format</label>
                  <div className="flex flex-wrap gap-2">
                    {([1, 2, 3] as KothFormat[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={format === f ? "aa-chip-active !px-3.5 !py-2 !text-sm" : "aa-chip !px-3.5 !py-2 !text-sm"}
                      >
                        {formatLabel(f)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Map</label>
                  {format === 1 ? (
                    <div className="px-4 py-3 aa-select">
                      Pool Day
                      <p className="text-gray-500 text-xs mt-1">1v1 is Pool Day only.</p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={map}
                        onChange={(e) => setMap(e.target.value)}
                        className="w-full px-4 py-3 aa-select"
                      >
                        {availableMaps.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <p className="text-gray-500 text-xs mt-1">No random maps — you pick it.</p>
                    </>
                  )}
                </div>
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Your team name</label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    maxLength={32}
                    placeholder="e.g. Hill Lords"
                    className="w-full px-4 py-3 aa-select"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || isPending || !isLoaded || !teamName.trim()}
                  className="aa-btn-primary px-6 py-3"
                >
                  {creating ? "Creating…" : `Create ${formatLabel(format)}`}
                </button>
                <p className="text-gray-400 text-sm">
                  You start on team A. Teammates join your side; challengers fill the other team,
                  then everyone readies up.
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">Sign in to create or challenge</p>
                <SignInButton mode="modal">
                  <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-white text-xl font-bold mb-4">Active Matches</h2>
            {loading ? (
              <div className="text-gray-400">Loading…</div>
            ) : activeMatches.length > 0 ? (
              <div className="space-y-4">
                {activeMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    userId={user?.id || null}
                    isLoggedIn={!!user}
                    onRefresh={loadMatches}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 border-2 border-dashed border-gray-600 rounded-lg text-center">
                <div className="text-gray-400 text-lg mb-2">No active matches</div>
                <div className="text-gray-500 text-sm">Create one and hold the hill.</div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-white text-xl font-bold mb-4">Recent Matches</h2>
            {recentMatches.length > 0 ? (
              <div className="space-y-3">
                {recentMatches.map((m) => (
                  <Link
                    key={m.id}
                    href={`/koth/${m.id}`}
                    className="aa-panel p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-amber-400">{formatLabel(m.format as KothFormat)}</span>
                      <span className="text-cyan-400">{m.map}</span>
                      <span className="text-gray-300">
                        {m.team_a_name} vs {m.team_b_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.status === "finalized" && m.team_a_score !== null && (
                        <span className="text-green-400 font-mono">
                          {m.team_a_score} - {m.team_b_score}
                        </span>
                      )}
                      <StatusBadge status={m.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No recent matches yet.</div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
