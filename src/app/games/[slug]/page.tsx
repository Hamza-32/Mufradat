import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { MatchPairs } from '@/components/games/MatchPairs';
import { MultipleChoice } from '@/components/games/MultipleChoice';
import { Harakat } from '@/components/games/Harakat';
import { Spelling } from '@/components/games/Spelling';
import { StreakRush } from '@/components/games/StreakRush';
import { getViewer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Games are full-screen tasks, like a review session: no navigation to drift into. */
export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ deck?: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const { deck } = await searchParams;
  const viewer = await getViewer();
  const signedIn = viewer !== null;
  const deckProp = deck ? { deckId: deck } : {};

  const game =
    slug === 'match-pairs' ? (
      <MatchPairs signedIn={signedIn} {...deckProp} />
    ) : slug === 'multiple-choice' ? (
      <MultipleChoice signedIn={signedIn} {...deckProp} />
    ) : slug === 'spelling' ? (
      <Spelling signedIn={signedIn} {...deckProp} />
    ) : slug === 'harakat' ? (
      <Harakat signedIn={signedIn} {...deckProp} />
    ) : slug === 'streak-rush' ? (
      <StreakRush signedIn={signedIn} {...deckProp} />
    ) : null;

  if (!game) notFound();

  return <AppShell chrome={false}>{game}</AppShell>;
}
