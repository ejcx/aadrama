"use client";

export const runtime = 'edge';

import { useParams } from "next/navigation";
import TrackerLayout from "../../TrackerLayout";
import Link from "next/link";
import { SessionContent } from "../SessionContent";

// Safely decode URI component - handles both encoded and non-encoded values
const safeDecodeURIComponent = (str: string): string => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

const SessionDetailPage = () => {
  const params = useParams();
  const rawId = params.id as string;
  
  // Split on + or %2B (encoded +) or space or ~
  // The browser/Next.js encodes + as %2B in the URL path
  // Then decode each individual session ID to handle encoded characters like %3A for :
  const sessionIds = rawId
    ? Array.from(new Set(
        rawId
          .split(/[+~ ]|%2B/i)
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
