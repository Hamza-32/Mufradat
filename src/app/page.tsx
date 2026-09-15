import type { ReactNode } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { panelStyles } from '@/components/ui/Panel';
import { ButtonLink } from '@/components/ui/Button';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { Landing } from '@/components/home/Landing';
import { getViewer } from '@/lib/auth/session';
import { getHomeSummary, type HomeSummary } from '@/lib/progress/home';
import { listDecks, searchWords } from '@/lib/words/queries';

export const dynamic = 'force-dynamic';

const GAMES = [
  { slug: 'match-pairs', key: 'matchPairs', sample: 'كِتَاب' },
  { slug: 'harakat', key: 'harakat', sample: 'كتاب' },
  { slug: 'multiple-choice', key: 'multipleChoice', sample: 'رَحْمَة' },
  { slug: 'spelling', key: 'spelling', sample: 'قَلَم' },
] as const;

/** Fourteen days of reviews, as a strip. No flame, no emoji — just the days. */
function ActivityStrip({ values, label }: { values: readonly number[]; label: string }): ReactNode {
  const peak = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[3px]" role="img" aria-label={label}>
      {values.map((value, index) => (
        <span
          key={index}
          className={value === 0 ? 'bg-hairline w-1.5' : 'bg-nil w-1.5'}
          style={{ blockSize: `${Math.max(3, (value / peak) * 28)}px` }}
        />
      ))}
    </div>
  );
}

export default async function HomePage(): Promise<ReactNode> {
  const t = await getTranslations();
  const home = await getTranslations('home');
  const locale = await getLocale();

  const viewer = await getViewer();
  // A guest's progress lives on their own device, so the server has no counts
  // to show them. They get an invitation instead of a lie.
  const summary: HomeSummary | null = viewer ? await getHomeSummary(viewer.id) : null;
  const decks = await listDecks();
  const byDeck = new Map(summary?.decks.map((deck) => [deck.deckId, deck]) ?? []);

  // Counted from the content rather than hard-coded, so the landing page cannot
  // drift the moment a word is added. Deck sizes are deliberately not summed: a
  // word may sit in two decks, and the total would count it twice.
  const totalWords = summary ? 0 : (await searchWords({ limit: 1 })).total;
  const quranWords = decks.find((deck) => deck.slug === 'quran-core-300')?.wordCount ?? 0;

  // A visitor who has not signed in gets the landing page instead of the app:
  // its own dark surface, its own nav, no empty progress counters.
  if (!summary) {
    return (
      <Landing
        decks={decks.map((deck) => ({
          id: deck.id,
          slug: deck.slug,
          title: locale === 'bn' ? deck.titleBengali : deck.titleEnglish,
          description: locale === 'bn' ? deck.descriptionBengali : deck.descriptionEnglish,
          wordCount: deck.wordCount,
        }))}
        totalWords={totalWords}
        quranWords={quranWords}
      />
    );
  }

  return (
    <AppShell>
      <PageBody className="space-y-8 pb-24 lg:space-y-10 lg:pb-8">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-dawat text-2xl font-semibold lg:text-3xl">
              {summary.dueCount > 0
                ? home.rich('dueToday', {
                    count: summary.dueCount,
                    n: (chunks) => (
                      <span className="text-shingraf" data-numeric>
                        {chunks}
                      </span>
                    ),
                  })
                : home('nothingDue')}
            </h1>

            <div className="flex items-center gap-3">
              <ActivityStrip
                values={summary.activity}
                label={t('home.streak', { days: summary.streak.current })}
              />
              <span className="text-pathor text-sm" data-numeric>
                {t('home.streak', { days: summary.streak.current })}
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <ButtonLink href="/review" variant="primary" size="lg">
              {t('home.startReview')}
            </ButtonLink>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
          <section className="space-y-3">
            <SectionHeading
              action={
                <Link href="/words" className="text-nil hover:underline">
                  {t('words.title')}
                </Link>
              }
            >
              {t('home.activeDecks')}
            </SectionHeading>
            <ul className="divide-hairline-soft divide-y">
              {decks.map((deck) => {
                const progress = byDeck.get(deck.id);
                return (
                  <li key={deck.id}>
                    <Link
                      href={`/review?deck=${deck.id}`}
                      className="min-h-touch rounded-ui hover:bg-nil-wash/40 -mx-2 flex flex-col gap-2 px-2 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <GlossText
                          script={locale === 'bn' ? 'bn' : 'en'}
                          className="text-dawat text-base font-semibold"
                        >
                          {locale === 'bn' ? deck.titleBengali : deck.titleEnglish}
                        </GlossText>
                        {progress && progress.due > 0 ? (
                          <span className="text-shingraf shrink-0 text-sm" data-numeric>
                            {t('home.dueCount', { count: progress.due })}
                          </span>
                        ) : null}
                      </div>
                      <ProgressBar
                        value={progress?.learned ?? 0}
                        max={progress?.total ?? deck.wordCount}
                        label={t('home.deckProgress', {
                          learned: progress?.learned ?? 0,
                          total: progress?.total ?? deck.wordCount,
                        })}
                      />
                      <span className="text-pathor text-xs" data-numeric>
                        {t('home.deckProgress', {
                          learned: progress?.learned ?? 0,
                          total: progress?.total ?? deck.wordCount,
                        })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <SectionHeading>{t('home.games')}</SectionHeading>
            {/* Phone: a scrolling shelf. Desktop: a two-up grid. */}
            <ul className="scroll-x -mx-4 flex snap-x gap-3 px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:px-0">
              {GAMES.map((game) => (
                <li key={game.slug} className="min-w-[9.5rem] shrink-0 snap-start md:min-w-0">
                  <Link
                    href={`/games/${game.slug}`}
                    className={panelStyles({
                      interactive: true,
                      className: 'min-h-touch flex h-full flex-col justify-between gap-4 p-3',
                    })}
                  >
                    <ArabicText size="sm" className="text-nil">
                      {game.sample}
                    </ArabicText>
                    <GlossText
                      script={locale === 'bn' ? 'bn' : 'en'}
                      className="text-dawat text-sm font-semibold"
                    >
                      {t(`games.${game.key}`)}
                    </GlossText>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PageBody>

      {/* Phone: the primary action lives in the lower third, above the nav. */}
      <div className="border-hairline bg-kagoj/95 fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 lg:hidden">
        <div className="pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom,0px)+0.75rem)]">
          <ButtonLink href="/review" variant="primary" size="lg" fullWidth>
            {t('home.startReview')}
          </ButtonLink>
        </div>
      </div>
    </AppShell>
  );
}
