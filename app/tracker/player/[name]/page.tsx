import { getPlayerBadges } from "../../actions";
import PlayerDetailClient from "./PlayerDetailClient";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const playerName = decodeURIComponent(name);
  const initialBadges = await getPlayerBadges(playerName);

  return <PlayerDetailClient initialBadges={initialBadges} />;
}
