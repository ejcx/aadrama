import { Suspense } from "react";
import TrackerLayout from "../TrackerLayout";
import { getBadgeCatalog } from "../actions";
import BadgesClient from "./BadgesClient";

export default async function BadgesPage() {
  const catalog = await getBadgeCatalog();

  return (
    <TrackerLayout title="Badges">
      <Suspense fallback={<div className="text-gray-400 text-center py-12">Loading badges...</div>}>
        <BadgesClient catalog={catalog} />
      </Suspense>
    </TrackerLayout>
  );
}
