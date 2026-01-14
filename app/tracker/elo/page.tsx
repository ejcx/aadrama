import TrackerLayout from "../TrackerLayout";
import { getEloLeaderboard, getEloChanges7Days, getRankedScrimMaps } from "../actions";
import EloClient from "./EloClient";

interface EloPlayer {
  game_name: string;
  game_name_lower: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  eloChange7Days: number;
  recentMatches: number;
}

export default async function EloRankingsPage() {
  // Fetch all players sorted by ELO and available maps in parallel
  const [eloRecords, maps] = await Promise.all([
    getEloLeaderboard(100),
    getRankedScrimMaps(),
  ]);

  // Get 7-day ELO changes for all players
  const gameNames = eloRecords?.map(p => p.game_name_lower) || [];
  const historyRecords = gameNames.length > 0 ? await getEloChanges7Days(gameNames) : [];

  // Calculate 7-day change and match count for each player
  const changeMap = new Map<string, { change: number; matches: number }>();
  for (const record of historyRecords || []) {
    const existing = changeMap.get(record.game_name_lower) || { change: 0, matches: 0 };
    changeMap.set(record.game_name_lower, {
      change: existing.change + record.elo_change,
      matches: existing.matches + 1,
    });
  }

  const eloPlayers: EloPlayer[] = (eloRecords || []).map(p => ({
    game_name: p.game_name,
    game_name_lower: p.game_name_lower,
    elo: p.elo,
    games_played: p.games_played,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    eloChange7Days: changeMap.get(p.game_name_lower)?.change || 0,
    recentMatches: changeMap.get(p.game_name_lower)?.matches || 0,
  }));

  return (
    <TrackerLayout title="ELO Rankings">
      <EloClient initialData={{ eloPlayers, maps }} />
    </TrackerLayout>
  );
}
