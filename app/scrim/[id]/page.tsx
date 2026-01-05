import type { Metadata } from 'next';
import ScrimDetailClient from './ScrimDetailClient';
import { createEdgeClient } from '@/lib/supabase/edge';

export const runtime = 'edge';

const API_BASE = "https://server-details.ej.workers.dev";

interface ScrimData {
  id: string;
  title: string | null;
  map: string | null;
  status: string;
  created_by_name: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner: string | null;
  tracker_session_id: string | null;
  player_count: number;
  created_at: string;
  finished_at: string | null;
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

interface Session {
  session_id: string;
  time_started: string;
  time_finished?: string;
  server_ip?: string;
  map?: string;
  peak_players?: number;
  duration?: number;
}

// Parse session IDs from tracker_session_id
const parseSessionIds = (trackerId: string): string[] => {
  let decoded = trackerId;
  try {
    let prev = '';
    while (prev !== decoded) {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    decoded = trackerId;
  }
  
  return Array.from(new Set(
    decoded
      .split(/[+~\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0)
  )).slice(0, 8);
};

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
        cache: 'no-store',
      });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData && !sessionData.error) {
          sessions.push(sessionData);
        }
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

// Generate dynamic metadata for Discord/social sharing
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: scrimId } = await params;
  
  try {
    const supabase = createEdgeClient();
    
    const { data: scrim, error } = await supabase
      .from('scrims_with_counts')
      .select('*')
      .eq('id', scrimId)
      .single();

    if (error || !scrim) {
      return {
        title: 'Scrim Not Found | AA Drama',
        description: 'This scrim could not be found.',
      };
    }

    const scrimData = scrim as ScrimData;
    
    // Status labels
    const statusLabels: Record<string, string> = {
      waiting: 'Waiting for Players',
      ready_check: 'Ready Check',
      in_progress: 'In Progress',
      scoring: 'Awaiting Scores',
      finalized: 'Completed',
      expired: 'Expired',
      cancelled: 'Cancelled',
    };
    const statusText = statusLabels[scrimData.status] || scrimData.status;
    const mapName = scrimData.map || 'Unknown Map';

    // Build description parts
    const descParts: string[] = [];
    descParts.push(`🗺️ ${mapName}`);
    descParts.push(`📊 ${statusText}`);
    descParts.push(`👥 ${scrimData.player_count} players`);
    
    // Final score if available
    if (scrimData.status === 'finalized' && scrimData.team_a_score !== null && scrimData.team_b_score !== null) {
      descParts.push(`🏆 ${scrimData.team_a_score} - ${scrimData.team_b_score}`);
    }

    const description = descParts.join(' • ');

    // Build longer description for Open Graph
    let ogDescription = description;

    // If there's tracker session data, fetch game stats (same as session page)
    if (scrimData.tracker_session_id) {
      const sessionIds = parseSessionIds(scrimData.tracker_session_id);
      
      if (sessionIds.length > 0) {
        const { sessions, analytics, players } = await fetchSessionData(sessionIds);
        
        // Aggregate stats
        let totalKills = 0;
        let totalDeaths = 0;
        analytics.forEach((a) => {
          totalKills += a.total_kills || 0;
          totalDeaths += a.total_deaths || 0;
        });

        // Calculate total duration
        let totalDuration = 0;
        sessions.forEach(s => {
          if (s.duration) totalDuration += s.duration;
        });

        if (totalKills > 0 || totalDeaths > 0) {
          ogDescription += `\n⚔️ ${totalKills} kills • 💀 ${totalDeaths} deaths`;
          if (totalDuration > 0) {
            ogDescription += ` • ⏱️ ${formatDuration(totalDuration)}`;
          }
        }

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

        if (topPlayers.length > 0) {
          ogDescription += `\n\n🏆 Top Players:\n${topPlayers.join('\n')}`;
          
          const remainingPlayers = sortedPlayers.length - 10;
          if (remainingPlayers > 0) {
            ogDescription += `\n... and ${remainingPlayers} more players`;
          }
        }
      }
    }

    // Add winner info
    if (scrimData.status === 'finalized' && scrimData.winner) {
      if (scrimData.winner === 'team_a') {
        ogDescription += '\n\n🎉 Team A Wins!';
      } else if (scrimData.winner === 'team_b') {
        ogDescription += '\n\n🎉 Team B Wins!';
      } else if (scrimData.winner === 'draw') {
        ogDescription += '\n\n🤝 Draw';
      }
    }

    // Add creator info
    if (scrimData.created_by_name) {
      ogDescription += `\n\nCreated by ${scrimData.created_by_name}`;
    }

    // Build title
    const title = scrimData.title 
      ? `${scrimData.title} | AA Drama`
      : `${mapName} Scrim | AA Drama`;

    const ogTitle = scrimData.title || `${mapName} Scrim`;

    return {
      title,
      description: ogDescription,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        type: 'website',
        siteName: 'AA Drama',
      },
      twitter: {
        card: 'summary',
        title: ogTitle,
        description: ogDescription,
      },
    };
  } catch (err) {
    console.error('Failed to generate scrim metadata:', err);
    return {
      title: 'Scrim | AA Drama',
      description: 'View scrim details on AA Drama',
    };
  }
}

export default function ScrimDetailPage() {
  return <ScrimDetailClient />;
}
