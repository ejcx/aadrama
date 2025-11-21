import PlayerDetailClient from "./PlayerDetailClient";

// Required for static export with dynamic routes
export function generateStaticParams() {
  // Return empty array since player names are dynamic and fetched at runtime
  return [];
}

export default function PlayerDetailPage() {
  return <PlayerDetailClient />;
}
