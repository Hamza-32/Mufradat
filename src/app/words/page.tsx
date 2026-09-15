import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { WordBrowser } from '@/components/words/WordBrowser';
import { listDecks, searchWords } from '@/lib/words/queries';

export const metadata: Metadata = { title: 'শব্দ' };
export const dynamic = 'force-dynamic';

export default async function WordsPage(): Promise<ReactNode> {
  const t = await getTranslations('words');
  const locale = await getLocale();

  // The unfiltered first page is rendered on the server, so the list is
  // readable before any JavaScript arrives — which matters on a slow phone.
  const [initial, decks] = await Promise.all([searchWords({ limit: 24 }), listDecks()]);

  return (
    <AppShell>
      <PageBody className="space-y-5">
        <SectionHeading>{t('title')}</SectionHeading>
        <WordBrowser
          initial={initial}
          decks={decks.map((deck) => ({
            id: deck.id,
            slug: deck.slug,
            title: locale === 'bn' ? deck.titleBengali : deck.titleEnglish,
          }))}
        />
      </PageBody>
    </AppShell>
  );
}
