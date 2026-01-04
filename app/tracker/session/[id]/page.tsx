"use client";

export const runtime = 'edge';

import { useParams } from "next/navigation";
import TrackerLayout from "../../TrackerLayout";
import Link from "next/link";
import { SessionContent } from "../SessionContent";

// Delimiter for multiple session IDs in URL
const SESSION_DELIMITER = "+";

// Safely decode URI component - handles both encoded and non-encoded values
const safeDecodeURIComponent = (str: string): string => {
  try {
    // Always try to decode - decodeURIComponent is safe on already-decoded strings
    // unless they contain % followed by invalid hex, which we catch
    return decodeURIComponent(str);
  } catch {
    // If decoding fails (malformed URI like a literal % not followed by hex), return original
    return str;
  }
};

const SessionDetailPage = () => {
  const params = useParams();
  const rawId = params.id as string;
  
  // Split on delimiter FIRST, then decode each individual session ID
  // This handles cases where the session IDs contain encoded characters like %3A for :
  const sessionIds = rawId
    ? Array.from(new Set(
        rawId
          .split(SESSION_DELIMITER)
          .map(id => safeDecodeURIComponent(id.trim()))
          .filter(id => id.length > 0)
      )).slice(0, 8)
    : [];

  const isMultipleSessions = sessionIds.length > 1;

  return (
    <TrackerLayout>
      <div className="mb-6">
        <Link
          href="/tracker/sessions"
          className="text-blue-400 hover:text-blue-300 hover:underline text-sm mb-2 inline-block"
        >
          ← Back to Sessions
        </Link>
        <h1 className="text-white text-xl sm:text-2xl md:text-3xl font-bold break-all">
          {isMultipleSessions 
            ? `Combined Sessions (${sessionIds.length})`
            : `Session ${sessionIds[0] || ''}`
          }
        </h1>
      </div>

      <SessionContent sessionIds={sessionIds} />
    </TrackerLayout>
  );
};

export default SessionDetailPage;
