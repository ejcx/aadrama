import TrackerLayout from "../TrackerLayout";
import { getRankedScrimMaps } from "../actions";
import TeammateStatsClient from "./TeammateStatsClient";

export default async function TeammateStatsPage() {
  const maps = await getRankedScrimMaps();

  return (
    <TrackerLayout title="Teammate Stats">
      <TeammateStatsClient initialMaps={maps} />
    </TrackerLayout>
  );
}
