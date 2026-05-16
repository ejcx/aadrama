import { getPlayerBadges, getPlayerScrimsAtEloFirstPlace } from "../../actions";
import PlayerDetailClient from "./PlayerDetailClient";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const [initialBadges, initialScrimsAtEloFirstPlace] = await Promise.all([
    getPlayerBadges(playerName),
    getPlayerScrimsAtEloFirstPlace(playerName),
  ]);

  return (
    <PlayerDetailClient
      initialBadges={initialBadges}
      initialScrimsAtEloFirstPlace={initialScrimsAtEloFirstPlace}
    />
  );
}
