"use client";

import { useEffect, useState } from "react";
import type { MapVetoStatus } from "@/app/scrim/actions";
import { mapImagePath, vetoLeaders } from "@/lib/scrim/veto";

/** Counts down from the server's number, so a wrong clock on the viewer's machine does not matter. */
function useCountdown(serverSecondsLeft: number | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(serverSecondsLeft);

  useEffect(() => {
    setSecondsLeft(serverSecondsLeft);
    if (serverSecondsLeft === null) return;

    const receivedAt = Date.now();
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, serverSecondsLeft - Math.floor((Date.now() - receivedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [serverSecondsLeft]);

  return secondsLeft;
}

/**
 * Map vote for veto scrims: 4 maps from the tiered pool, most votes wins, ties are a coin flip.
 * Players vote in the lobby before teams are picked, and again if the map is rerolled.
 */
export default function MapVetoPanel({
  status,
  onVote,
  disabled = false,
  className = "",
}: {
  status: MapVetoStatus;
  /** Casts the vote. The options stay locked until it settles. */
  onVote: (map: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const [voting, setVoting] = useState(false);
  const secondsLeft = useCountdown(status.open ? status.secondsLeft : null);
  const leaders = status.open ? vetoLeaders(status.options) : [];

  async function vote(map: string) {
    if (voting) return;
    setVoting(true);
    try {
      await onVote(map);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className={`p-3 sm:p-4 bg-cyan-900/20 border border-cyan-700/50 rounded-lg ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-cyan-400 text-sm font-semibold">
          🗳️ {status.open ? "Vote for the map" : "Map vote result"}
        </span>
        <span className="text-sm text-gray-400">
          <span className="font-mono text-gray-200">
            {status.votesCast}/{status.totalPlayers}
          </span>{" "}
          voted
          {status.open && secondsLeft !== null && (
            <span className={`ml-2 font-mono ${secondsLeft <= 30 ? "text-amber-300" : "text-cyan-300"}`}>
              {secondsLeft > 0
                ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")} left`
                : "closing..."}
            </span>
          )}
        </span>
      </div>

      <p className="text-gray-400 text-xs mb-3">
        {status.open
          ? status.phase === "lobby"
            ? "Ready up to vote. Most votes wins and a tie for first is settled by a coin flip. Teams are picked once the lobby is full and the vote is decided."
            : "New maps. Vote again. Most votes wins and a tie for first is settled by a coin flip."
          : status.votesCast === 0
            ? `No votes. ${status.winner} was picked at random.`
            : status.tiebreak
              ? `Tied vote. ${status.winner} won the coin flip.`
              : `${status.winner} won the vote.`}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {status.options.map((option) => {
          const image = mapImagePath(option.map);
          const isWinner = !status.open && option.map === status.winner;
          const isMine = status.myVote === option.map;
          const isLeading = leaders.includes(option.map);
          const share = status.totalPlayers > 0 ? (option.votes / status.totalPlayers) * 100 : 0;

          return (
            <button
              key={option.map}
              type="button"
              onClick={() => vote(option.map)}
              disabled={disabled || voting || !status.canVote || isMine}
              aria-pressed={isMine}
              title={option.voters.length > 0 ? `Voted: ${option.voters.join(", ")}` : undefined}
              className={`group relative overflow-hidden rounded-lg border text-left transition-colors disabled:cursor-default ${
                isWinner
                  ? "border-green-500 ring-1 ring-green-500/60"
                  : isMine
                    ? "border-cyan-400 ring-1 ring-cyan-400/60"
                    : "border-gray-700 enabled:hover:border-cyan-600"
              } ${!status.open && !isWinner ? "opacity-50" : ""}`}
            >
              <div className="relative aspect-[4/3] bg-gray-900">
                {image && (
                  <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                {(isWinner || isMine) && (
                  <span
                    className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                      isWinner ? "bg-green-600 text-white" : "bg-cyan-500 text-black"
                    }`}
                  >
                    {isWinner ? "Winner" : "Your vote"}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <div className="text-white text-sm font-semibold leading-tight">{option.map}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-700/80 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isWinner || isLeading ? "bg-green-500" : "bg-cyan-500"
                        }`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-gray-200">
                      {option.votes}
                      <span className="sr-only"> votes</span>
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {status.open && !status.canVote && (
        <p className="text-gray-500 text-xs mt-2">
          {status.needsReady ? "Ready up to vote." : "Only players in this scrim can vote."}
        </p>
      )}
    </div>
  );
}
