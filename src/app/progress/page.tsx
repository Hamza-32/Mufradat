import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Panel } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/States';
import {
  Forecast,
  MasteryBreakdown,
  RetentionCard,
  YearHeatmap,
} from '@/components/progress/Charts';
import { getViewer } from '@/lib/auth/session';
import { getProgressStats } from '@/lib/progress/stats';
import { masteryTotal } from '@/lib/progress/heatmap';

export const metadata: Metadata = { title: 'অগ্রগতি' };
export const dynamic = 'force-dynamic';

/**
 * Phone: one column, the year scrolling sideways. Desktop: the year and the
 * fourteen-day forecast side by side, which is what the width is for — the
 * two questions a learner actually has are "have I been showing up" and "what
 * is coming", and they are better answered together.
 *
 * A guest has no server-side history, so they are told that plainly rather than
 * shown an empty chart.
 */
export default async function ProgressPage(): Promise<ReactNode> {
  const t = await getTranslations('progress');
  const locale = await getLocale();
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <AppShell>
        <PageBody className="space-y-5">
          <SectionHeading>{t('title')}</SectionHeading>
          <EmptyState
            title={t('guestTitle')}
            body={t('guestBody')}
            action={{ label: t('signIn'), href: '/signin' }}
          />
        </PageBody>
      </AppShell>
    );
  }

  const stats = await getProgressStats(viewer.id);
  const words = masteryTotal(stats.mastery);

  if (stats.totals.reviews === 0) {
    return (
      <AppShell>
        <PageBody className="space-y-5">
          <SectionHeading>{t('title')}</SectionHeading>
          <EmptyState
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={{ label: t('startReview'), href: '/review' }}
          />
        </PageBody>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageBody className="space-y-8">
        <SectionHeading>{t('title')}</SectionHeading>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:gap-10">
          <YearHeatmap
            grid={stats.heatmap}
            totalDays={stats.totals.daysStudied}
            streak={stats.streak}
          />

          <section className="space-y-3">
            <SectionHeading level={3}>{t('forecastTitle')}</SectionHeading>
            <Forecast days={stats.forecast} />
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          <section className="space-y-3 lg:col-span-1">
            <SectionHeading level={3}>{t('masteryTitle')}</SectionHeading>
            <MasteryBreakdown counts={stats.mastery} />
          </section>

          <section className="space-y-3 lg:col-span-1">
            <SectionHeading level={3}>{t('effortTitle')}</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <RetentionCard retention={stats.retention} windowDays={stats.retentionWindowDays} />
              <Panel className="space-y-1 p-4">
                <p className="text-pathor text-sm">{t('totalReviews')}</p>
                <p className="text-dawat text-3xl font-semibold" data-numeric>
                  {stats.totals.reviews}
                </p>
                <p className="text-pathor text-xs" data-numeric>
                  {t('totalMinutes', { minutes: stats.totals.minutes, words })}
                </p>
              </Panel>
            </div>
          </section>

          <section className="space-y-3 lg:col-span-1">
            <SectionHeading level={3}>{t('decksTitle')}</SectionHeading>
            <ul className="divide-hairline-soft divide-y">
              {stats.decks.map((deck) => (
                <li key={deck.deckId}>
                  <Link
                    href={`/review?deck=${deck.deckId}`}
                    className="min-h-touch rounded-ui hover:bg-nil-wash/40 -mx-2 flex flex-col gap-2 px-2 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-dawat text-sm font-semibold">
                        {locale === 'bn' ? deck.titleBengali : deck.titleEnglish}
                      </span>
                      <span className="text-pathor shrink-0 text-xs" data-numeric>
                        {t('deckCounts', { started: deck.started, total: deck.total })}
                      </span>
                    </div>
                    <ProgressBar
                      value={deck.started}
                      max={deck.total}
                      label={t('deckCounts', { started: deck.started, total: deck.total })}
                    />
                    <span className="text-2xs text-pathor" data-numeric>
                      {t('deckMature', { count: deck.mature })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PageBody>
    </AppShell>
  );
}
