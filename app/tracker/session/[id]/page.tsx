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
    // Check if the string appears to be URI encoded (contains %XX patterns)
    // If so, decode it; otherwise return as-is
    if (/%[0-9A-Fa-f]{2}/.test(str)) {
      return decodeURIComponent(str);
    }
    return str;
  } catch {
    // If decoding fails (malformed URI), return original string
    return str;
  }
};

const SessionDetailPage = () => {
  const params = useParams();
  const rawId = params.id as string;
  
  // Split on delimiter, dedupe, and limit to 8 sessions
  // Safely decode URI components to handle both encoded and non-encoded values
  const sessionIds = rawId
    ? Array.from(new Set(
        safeDecodeURIComponent(rawId)
          .split(SESSION_DELIMITER)
          .map(id => id.trim())
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
