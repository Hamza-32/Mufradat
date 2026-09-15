import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { panelStyles } from '@/components/ui/Panel';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';

export const metadata: Metadata = { title: 'খেলা' };

/**
 * Every game draws from the review queue, so a round counts as study. The list
 * says so once, here, rather than repeating it on each card.
 */
const GAMES = [
  { slug: 'match-pairs', key: 'matchPairs', sample: 'كِتَاب', ready: true },
  { slug: 'multiple-choice', key: 'multipleChoice', sample: 'رَحْمَة', ready: true },
  { slug: 'listening', key: 'listening', sample: 'سَمَاء', ready: false },
  { slug: 'spelling', key: 'spelling', sample: 'قَلَم', ready: true },
  { slug: 'harakat', key: 'harakat', sample: 'كتاب', ready: true },
  { slug: 'streak-rush', key: 'streakRush', sample: 'يَوْم', ready: true },
] as const;

export default async function GamesPage(): Promise<ReactNode> {
  const t = await getTranslations('games');

  return (
    <AppShell>
      <PageBody className="space-y-5">
        <SectionHeading>{t('title')}</SectionHeading>
        <p className="measure text-pathor text-base">{t('intro')}</p>

        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GAMES.map((game) => {
            const body = (
              <>
                <ArabicText size="sm" className={game.ready ? 'text-nil' : 'text-pathor-soft'}>
                  {game.sample}
                </ArabicText>
                <div className="space-y-1">
                  <GlossText script="bn" className="text-dawat block text-base font-semibold">
                    {t(game.key)}
                  </GlossText>
                  <span className="text-pathor block text-sm">
                    {game.ready ? t(`${game.key}Short`) : t('comingSoon')}
                  </span>
                </div>
              </>
            );

            return (
              <li key={game.slug}>
                {game.ready ? (
                  <Link
                    href={`/games/${game.slug}`}
                    className={panelStyles({
                      interactive: true,
                      className: 'flex h-full min-h-32 flex-col justify-between gap-4 p-4',
                    })}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className={panelStyles({
                      className:
                        'flex h-full min-h-32 flex-col justify-between gap-4 p-4 opacity-60',
                    })}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </PageBody>
    </AppShell>
  );
}
