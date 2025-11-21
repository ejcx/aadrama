import PlayerDetailClient from "./PlayerDetailClient";

// Configure Edge Runtime for Cloudflare Pages
export const runtime = 'edge';

export default function PlayerDetailPage() {
  return <PlayerDetailClient />;
}
