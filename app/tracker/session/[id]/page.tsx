import SessionDetailClient from "./SessionDetailClient";

// Configure Edge Runtime for Cloudflare Pages
export const runtime = 'edge';

// Required for static export with dynamic routes
export function generateStaticParams() {
  // Return empty array since session IDs are dynamic and fetched at runtime
  return [];
}

export default function SessionDetailPage() {
  return <SessionDetailClient />;
}

