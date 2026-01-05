export const runtime = 'edge';

import type { Metadata } from 'next';
import ScrimDetailClient from './ScrimDetailClient';
import { createEdgeClient } from '@/lib/supabase/edge';

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

interface SessionAnalytics {
  total_kills?: number;
  total_deaths?: number;
  player_count?: number;
}

interface SessionPlayer {
  name: string;
  kills: number;
  deaths: number;
}

// Parse session IDs from tracker_session_id
const parseSessionIds = (trackerId: string): string[] => {
  try {
    const decoded = decodeURIComponent(trackerId);
    return decoded
      .split(/[+~\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .slice(0, 8);
  } catch {
    return trackerId
      .split(/[+~\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .slice(0, 8);
  }
};

// Fetch session stats for metadata
async function fetchSessionStats(sessionIds: string[]): Promise<{
  totalKills: number;
  totalDeaths: number;
  topPlayers: { name: string; kills: number; deaths: number }[];
}> {
  let totalKills = 0;
  let totalDeaths = 0;
  const playerMap = new Map<string, { kills: number; deaths: number }>();

  await Promise.all(sessionIds.map(async (id) => {
    try {
      // Fetch analytics
      const analyticsRes = await fetch(`${API_BASE}/analytics/sessions/${id}`, {
        cache: 'no-store',
      });
      if (analyticsRes.ok) {
        const data: SessionAnalytics = await analyticsRes.json();
        if (data && !('error' in data)) {
          totalKills += data.total_kills || 0;
          totalDeaths += data.total_deaths || 0;
        }
      }

      // Fetch players
      const playersRes = await fetch(`${API_BASE}/sessions/${id}/players`, {
        cache: 'no-store',
      });
      if (playersRes.ok) {
        const data = await playersRes.json();
        const players: SessionPlayer[] = Array.isArray(data) ? data : (data.players || []);
        players.forEach(p => {
          const existing = playerMap.get(p.name);
          if (existing) {
            existing.kills += p.kills;
            existing.deaths += p.deaths;
          } else {
            playerMap.set(p.name, { kills: p.kills, deaths: p.deaths });
          }
        });
      }
    } catch (err) {
      console.error(`Failed to fetch stats for session ${id}:`, err);
    }
  }));

  const topPlayers = Array.from(playerMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 10);

  return { totalKills, totalDeaths, topPlayers };
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
    
    // Build title
    const mapName = scrimData.map || 'Unknown Map';
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
    
    let title = scrimData.title || `${mapName} Scrim`;
    title += ` | AA Drama`;

    // Build description parts
    const descParts: string[] = [];
    
    // Map and status
    descParts.push(`🗺️ ${mapName}`);
    descParts.push(`📊 ${statusText}`);
    descParts.push(`👥 ${scrimData.player_count} players`);
    
    // Final score if available
    if (scrimData.status === 'finalized' && scrimData.team_a_score !== null && scrimData.team_b_score !== null) {
      descParts.push(`🏆 Score: ${scrimData.team_a_score} - ${scrimData.team_b_score}`);
      
      if (scrimData.winner === 'team_a') {
        descParts.push('Team A Wins!');
      } else if (scrimData.winner === 'team_b') {
        descParts.push('Team B Wins!');
      } else if (scrimData.winner === 'draw') {
        descParts.push('Draw');
      }
    }

    let description = descParts.join(' • ');
    let ogDescription = description;

    // If there's tracker session data, fetch game stats
    if (scrimData.tracker_session_id) {
      const sessionIds = parseSessionIds(scrimData.tracker_session_id);
      if (sessionIds.length > 0) {
        const { totalKills, totalDeaths, topPlayers } = await fetchSessionStats(sessionIds);
        
        if (totalKills > 0 || totalDeaths > 0) {
          ogDescription += `\n\n⚔️ ${totalKills} kills • 💀 ${totalDeaths} deaths`;
        }
        
        if (topPlayers.length > 0) {
          ogDescription += `\n\n🏆 Top Players:`;
          topPlayers.forEach((p, i) => {
            const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : (p.kills > 0 ? '∞' : '0.00');
            ogDescription += `\n${i + 1}. ${p.name}: ${p.kills}K/${p.deaths}D (${kd} K/D)`;
          });
        }
      }
    }

    // Add creator info
    if (scrimData.created_by_name) {
      ogDescription += `\n\nCreated by ${scrimData.created_by_name}`;
    }

    return {
      title,
      description: ogDescription,
      openGraph: {
        title: scrimData.title || `${mapName} Scrim`,
        description: ogDescription,
        type: 'website',
        siteName: 'AA Drama',
      },
      twitter: {
        card: 'summary',
        title: scrimData.title || `${mapName} Scrim`,
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
