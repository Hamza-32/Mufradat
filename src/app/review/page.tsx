import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { ReviewSession } from '@/components/review/ReviewSession';
import { getViewer } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'পড়া' };
export const dynamic = 'force-dynamic';

/**
 * `chrome={false}`: no bottom bar, no sidebar. Leaving a session should be a
 * deliberate act — the close control at the top, or escape on a keyboard —
 * rather than a thumb brushing the navigation.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}): Promise<ReactNode> {
  const viewer = await getViewer();
  const { deck } = await searchParams;

  return (
    <AppShell chrome={false}>
      <ReviewSession signedIn={viewer !== null} {...(deck ? { deckId: deck } : {})} />
    </AppShell>
  );
}
