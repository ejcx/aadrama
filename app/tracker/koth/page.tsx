import TrackerLayout from "../TrackerLayout";
import { getKothLeaderboard } from "@/app/koth/actions";
import KothLeaderboardClient from "./KothLeaderboardClient";
import type { KothFormat } from "@/lib/koth/format";

export default async function KothRankingsPage() {
  const initialFormat: KothFormat = 1;
  const teams = await getKothLeaderboard(initialFormat);

  return (
    <TrackerLayout title="King of the Hill" subtitle="Team ELO by format — 1v1, 2v2, 3v3">
      <KothLeaderboardClient initialFormat={initialFormat} initialTeams={teams} />
    </TrackerLayout>
  );
}
