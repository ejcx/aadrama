"use client";

import Link from "next/link";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { SessionContent } from "../tracker/session/SessionContent";

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  map?: string;
  server_ip?: string;
  peak_players?: number;
}

interface SessionHoverPopoverProps {
  session: Session;
  className?: string;
}

export const SessionHoverPopover = ({
  session,
  className,
}: SessionHoverPopoverProps) => {
  return (
    <HoverCard openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <Link
          href={`/tracker/session/${encodeURIComponent(session.session_id)}`}
          className={
            className ||
            "text-blue-400 hover:text-blue-300 hover:underline font-mono text-xs truncate block max-w-[100px] sm:max-w-none"
          }
        >
          {session.session_id}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-[420px] max-h-[500px] overflow-y-auto bg-gray-800 border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 p-0"
        sideOffset={8}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Session Details
            </h3>
          </div>
          <SessionContent sessionIds={[session.session_id]} compact />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

