import type { Metadata } from 'next';
import TrackerLayout from "../../TrackerLayout";
import Link from "next/link";
import { SessionContent } from "../SessionContent";

export const runtime = 'edge';

const API_BASE = "https://server-details.ej.workers.dev";

// Safely decode URI component - handles both encoded and non-encoded values
const safeDecodeURIComponent = (str: string): string => {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

// Parse session IDs from the URL parameter
const parseSessionIds = (rawId: string): string[] => {
  // First, decode the entire string to normalize all encodings
  // This handles cases where + is %2B or space is %20
  let decoded = rawId;
  try {
    // Keep decoding until stable (handles double-encoding)
    let prev = '';
    while (prev !== decoded) {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // If decoding fails, use the original
    decoded = rawId;
  }
  
  // Now split on all possible delimiters (after decoding, + becomes space or stays as +)
  // Split on: + (plus), ~ (tilde), space, or multiple spaces
  return Array.from(new Set(
    decoded
      .split(/[+~\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0)
  )).slice(0, 8);
};

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  server_ip?: string;
  map?: string;
  peak_players?: number;
  duration?: number;
}

interface SessionPlayer {
  name: string;
  kills: number;
  deaths: number;
}

interface SessionAnalytics {
  total_kills?: number;
  total_deaths?: number;
  player_count?: number;
  duration?: number;
}

// Fetch session data for metadata generation
async function fetchSessionData(sessionIds: string[]): Promise<{
  sessions: Session[];
  analytics: Map<string, SessionAnalytics>;
  players: Map<string, SessionPlayer[]>;
}> {
  const sessions: Session[] = [];
  const analytics = new Map<string, SessionAnalytics>();
  const players = new Map<string, SessionPlayer[]>();

  await Promise.all(sessionIds.map(async (id) => {
    try {
      // Fetch session info
      const sessionRes = await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}`, {
        cache: 'no-store', // Don't cache to ensure fresh data on edge
      });
      if (!sessionRes.ok) {
        console.error(`Session fetch failed for ${id}: ${sessionRes.status}`);
        return;
      }
      const sessionData = await sessionRes.json();
      if (sessionData && !sessionData.error) {
        sessions.push(sessionData);
      }

      // Fetch analytics
      const analyticsRes = await fetch(`${API_BASE}/analytics/sessions/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        if (analyticsData && !analyticsData.error) {
          analytics.set(id, analyticsData);
        }
      }

      // Fetch players
      const playersRes = await fetch(`${API_BASE}/sessions/${encodeURIComponent(id)}/players`, {
        cache: 'no-store',
      });
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        if (Array.isArray(playersData)) {
          players.set(id, playersData);
        } else if (playersData.players && Array.isArray(playersData.players)) {
          players.set(id, playersData.players);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch data for session ${id}:`, err);
    }
  }));

  return { sessions, analytics, players };
}

// Format duration for display
const formatDuration = (seconds?: number): string => {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Generate dynamic metadata for Discord/social sharing
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: rawId } = await params;
  const sessionIds = parseSessionIds(rawId);
  
  if (sessionIds.length === 0) {
    return {
      title: 'Session Not Found | AA Drama Tracker',
      description: 'Session not found',
    };
  }

  const { sessions, analytics, players } = await fetchSessionData(sessionIds);
  
  if (sessions.length === 0) {
    return {
      title: 'Session Not Found | AA Drama Tracker',
      description: 'Session not found',
    };
  }

  // Aggregate stats
  let totalKills = 0;
  let totalDeaths = 0;
  analytics.forEach((a) => {
    totalKills += a.total_kills || 0;
    totalDeaths += a.total_deaths || 0;
  });

  // Get unique players count
  const uniquePlayerNames = new Set<string>();
  players.forEach((playerList) => {
    playerList.forEach((p) => uniquePlayerNames.add(p.name));
  });
  const playerCount = uniquePlayerNames.size;

  // Get top 10 players by kills
  const aggregatedPlayers = new Map<string, { kills: number; deaths: number }>();
  players.forEach((playerList) => {
    playerList.forEach((p) => {
      const existing = aggregatedPlayers.get(p.name);
      if (existing) {
        existing.kills += p.kills;
        existing.deaths += p.deaths;
      } else {
        aggregatedPlayers.set(p.name, { kills: p.kills, deaths: p.deaths });
      }
    });
  });
  const sortedPlayers = Array.from(aggregatedPlayers.entries())
    .sort((a, b) => b[1].kills - a[1].kills);
  const topPlayers = sortedPlayers
    .slice(0, 10)
    .map(([name, stats], i) => `${i + 1}. ${name}: ${stats.kills}K/${stats.deaths}D`);

  // Get maps
  const uniqueMaps = Array.from(new Set(sessions.map(s => s.map).filter(Boolean)));
  const mapText = uniqueMaps.length > 0 ? uniqueMaps.join(', ') : 'Unknown Map';

  // Calculate total duration
  let totalDuration = 0;
  sessions.forEach(s => {
    if (s.duration) totalDuration += s.duration;
  });

  // Build title
  const isMultiple = sessions.length > 1;
  const title = isMultiple 
    ? `${sessions.length} Combined Sessions | AA Drama Tracker`
    : `${mapText} Session | AA Drama Tracker`;

  // Build description with key stats
  const descParts: string[] = [];
  
  if (uniqueMaps.length > 0) {
    descParts.push(`🗺️ ${mapText}`);
  }
  
  descParts.push(`👥 ${playerCount} players`);
  descParts.push(`⚔️ ${totalKills} kills`);
  descParts.push(`💀 ${totalDeaths} deaths`);
  
  if (totalDuration > 0) {
    descParts.push(`⏱️ ${formatDuration(totalDuration)}`);
  }

  const description = descParts.join(' • ');

  // Build longer description for Open Graph
  let ogDescription = description;
  if (topPlayers.length > 0) {
    ogDescription += `\n\n🏆 Top Players:\n${topPlayers.join('\n')}`;
    
    // Show how many more players if there are more than 10
    const remainingPlayers = sortedPlayers.length - 10;
    if (remainingPlayers > 0) {
      ogDescription += `\n... and ${remainingPlayers} more players`;
    }
  }

  return {
    title,
    description: ogDescription,
    openGraph: {
      title: isMultiple ? `${sessions.length} Combined Sessions` : `${mapText} Session`,
      description: ogDescription,
      type: 'website',
      siteName: 'AA Drama Tracker',
    },
    twitter: {
      card: 'summary',
      title: isMultiple ? `${sessions.length} Combined Sessions` : `${mapText} Session`,
      description: ogDescription,
    },
  };
}

// Server component that renders the page
export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const sessionIds = parseSessionIds(rawId);
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
}
