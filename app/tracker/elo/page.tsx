"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import TrackerLayout from "../TrackerLayout";
import { createClient } from "@/lib/supabase/client";

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

const EloRankingsPage = () => {
  const supabase = useMemo(() => createClient(), []);
  const [eloPlayers, setEloPlayers] = useState<EloPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEloPlayers = async () => {
      try {
        setLoading(true);
        
        // Fetch all players sorted by ELO
        const { data: eloRecords, error: eloError } = await supabase
          .from('player_elo')
          .select('*')
          .order('elo', { ascending: false })
          .limit(100);
        
        if (eloError) {
          throw eloError;
        }
        
        if (!eloRecords || eloRecords.length === 0) {
          setEloPlayers([]);
          setLoading(false);
          return;
        }
        
        // Get 7-day ELO changes for all players
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const gameNames = eloRecords.map(p => p.game_name_lower);
        
        const { data: historyRecords } = await supabase
          .from('elo_history')
          .select('game_name_lower, elo_change')
          .in('game_name_lower', gameNames)
          .gte('created_at', sevenDaysAgo.toISOString());
        
        // Calculate 7-day change and match count for each player
        const changeMap = new Map<string, { change: number; matches: number }>();
        for (const record of historyRecords || []) {
          const existing = changeMap.get(record.game_name_lower) || { change: 0, matches: 0 };
          changeMap.set(record.game_name_lower, {
            change: existing.change + record.elo_change,
            matches: existing.matches + 1,
          });
        }
        
        const players: EloPlayer[] = eloRecords.map(p => ({
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
        
        setEloPlayers(players);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch ELO leaderboard:', err);
        setError('Failed to fetch ELO rankings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEloPlayers();
  }, [supabase]);

  return (
    <TrackerLayout title="ELO Rankings">
      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-white text-center py-12">Loading...</div>}

      {/* Content */}
      {!loading && (
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
                {eloPlayers.length > 0 ? (
                  eloPlayers.map((player, index) => (
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
                        <Link
                          href={`/tracker/player/${encodeURIComponent(player.game_name)}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                        >
                          {player.game_name}
                        </Link>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No ranked players yet. Play some scrims to get on the leaderboard!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </TrackerLayout>
  );
};

export default EloRankingsPage;

