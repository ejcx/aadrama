export const runtime = 'edge';

import type { Metadata } from 'next';
import KothDetailClient from './KothDetailClient';
import { createEdgeClient } from '@/lib/supabase/edge';
import { formatLabel, type KothFormat } from '@/lib/koth/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = createEdgeClient();
    const { data: match } = await supabase
      .from('koth_matches_with_counts')
      .select('*')
      .eq('id', id)
      .single();

    if (!match) {
      return { title: 'Match Not Found | AA Drama' };
    }

    const label = formatLabel(match.format as KothFormat);
    const title = `${match.team_a_name} vs ${match.team_b_name} (${label}) | AA Drama`;
    const score =
      match.status === 'finalized' && match.team_a_score != null
        ? ` ${match.team_a_score}-${match.team_b_score}`
        : '';
    const description = `King of the Hill ${label} on ${match.map}.${score}`;

    return {
      title,
      description,
      openGraph: { title, description, type: 'website', siteName: 'AA Drama' },
    };
  } catch {
    return { title: 'King of the Hill | AA Drama' };
  }
}

export default function KothDetailPage() {
  return <KothDetailClient />;
}
