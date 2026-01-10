import Link from "next/link";
import TrackerLayout from "../TrackerLayout";
import { getEloLeaderboard, getEloChanges7Days } from "../actions";

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
  // Fetch all players sorted by ELO
  const eloRecords = await getEloLeaderboard(100);

  if (!eloRecords || eloRecords.length === 0) {
    return (
      <TrackerLayout title="ELO Rankings">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          No ranked players yet. Play some scrims to get on the leaderboard!
        </div>
      </TrackerLayout>
    );
  }

  // Get 7-day ELO changes for all players
  const gameNames = eloRecords.map(p => p.game_name_lower);
  const historyRecords = await getEloChanges7Days(gameNames);

  // Calculate 7-day change and match count for each player
  const changeMap = new Map<string, { change: number; matches: number }>();
  for (const record of historyRecords || []) {
    const existing = changeMap.get(record.game_name_lower) || { change: 0, matches: 0 };
    changeMap.set(record.game_name_lower, {
      change: existing.change + record.elo_change,
      matches: existing.matches + 1,
    });
  }

  const eloPlayers: EloPlayer[] = eloRecords.map(p => ({
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
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-white text-xs sm:text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Rank</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4">Player</th>
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4">ELO</th>
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4">7d Change</th>
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Games</th>
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4">W-L-D</th>
                <th className="text-center py-2 sm:py-3 px-2 sm:px-4">Win%</th>
              </tr>
            </thead>
            <tbody>
              {eloPlayers.map((player, index) => (
                <tr
                  key={player.game_name_lower}
                  className="border-b border-gray-800 hover:bg-gray-800"
                >
                  <td className="py-2 sm:py-3 px-2 sm:px-4">
                    <span className={`font-bold ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-400' :
                      'text-gray-500'
                    }`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tracker/player/${encodeURIComponent(player.game_name)}`}
                        className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                      >
                        {player.game_name}
                      </Link>
                      {player.game_name_lower.includes('mediocre') && (
                        <span
                          className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-900/80 text-red-300 border border-red-700 rounded cursor-help"
                          title="Banned until Saturday 8:00 PM — Player intentionally losing rounds on insurgent camp"
                        >
                          🚫 Banned
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                    <span className="text-yellow-400 font-bold text-base">{player.elo}</span>
                  </td>
                  <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                    {player.eloChange7Days !== 0 ? (
                      <span className={`font-semibold ${player.eloChange7Days > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {player.eloChange7Days > 0 ? '▲' : '▼'} {player.eloChange7Days > 0 ? '+' : ''}{player.eloChange7Days}
                      </span>
                    ) : (
                      <span className="text-gray-500">─</span>
                    )}
                  </td>
                  <td className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300">
                    {player.games_played}
                  </td>
                  <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                    <span className="text-green-400">{player.wins}</span>
                    <span className="text-gray-500">-</span>
                    <span className="text-red-400">{player.losses}</span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-400">{player.draws}</span>
                  </td>
                  <td className="text-center py-2 sm:py-3 px-2 sm:px-4">
                    {player.games_played > 0 ? (
                      <span className={`font-medium ${
                        (player.wins / player.games_played) >= 0.5 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {((player.wins / player.games_played) * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-500">─</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TrackerLayout>
  );
}
