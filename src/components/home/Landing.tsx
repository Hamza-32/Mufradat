import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { getUserLocale } from '@/i18n/locale';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { HeroCard3D, type HeroWord } from '@/components/home/HeroCard3D';

/**
 * The signed-out landing page: a dark shopfront in front of a light product.
 *
 * It deliberately does not wear the app's chrome. A visitor who has not signed
 * in has no progress to navigate back to, so a sidebar full of empty counters
 * is noise; what they need is to understand the thing in one screen and press
 * one button. The moment they start learning they are on the paper palette and
 * never see this page again.
 */

const HERO_WORDS: readonly HeroWord[] = [
  { arabic: 'كِتَاب', transliteration: 'kitāb', bengali: 'বই, কিতাব', english: 'book, scripture' },
  { arabic: 'رَحْمَة', transliteration: 'raḥmah', bengali: 'দয়া, রহমত', english: 'mercy' },
  { arabic: 'عِلْم', transliteration: 'ʿilm', bengali: 'জ্ঞান, ইলম', english: 'knowledge' },
  { arabic: 'نُور', transliteration: 'nūr', bengali: 'আলো, নূর', english: 'light' },
];

const NAV = [
  { href: '/review', key: 'review' },
  { href: '/words', key: 'words' },
  { href: '/games', key: 'games' },
  { href: '/notes', key: 'notes' },
  { href: '/progress', key: 'progress' },
] as const;

export interface LandingDeck {
  id: string;
  slug: string;
  title: string;
  description: string;
  wordCount: number;
}

export async function Landing({
  decks,
  totalWords,
  quranWords,
}: {
  decks: readonly LandingDeck[];
  totalWords: number;
  quranWords: number;
}): Promise<ReactNode> {
  const t = await getTranslations();
  const home = await getTranslations('home');
  const legal = await getTranslations('legal');
  const locale = await getUserLocale();

  return (
    <div className="bg-layl text-subh min-h-dvh">
      <a
        href="#main"
        className="focus:rounded-ui focus:bg-jamr focus:text-subh sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      {/* --- Top bar ------------------------------------------------------ */}
      <header className="border-layl-line/70 bg-layl-deep/80 border-b">
        <nav className="mx-auto flex w-full max-w-[80rem] items-center gap-4 px-4 py-3 md:px-6">
          <GlossText script="bn" className="text-subh text-lg font-semibold">
            মুফরাদাত
          </GlossText>

          <ul className="ms-2 flex flex-wrap items-center gap-0.5 md:ms-4 md:gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-ui text-subh-soft hover:bg-layl-soft hover:text-subh px-2 py-2 text-xs font-semibold transition-colors md:px-3 md:text-sm"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle locale={locale} tone="dark" className="hidden sm:flex" />
            <Link
              href="/signin"
              className="border-layl-line text-subh hover:bg-layl-soft rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* --- Hero ------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          {/* Two soft lights, warm and cool, so the navy is lit rather than flat. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(48% 42% at 14% 8%, rgb(71 166 223 / 0.20) 0%, transparent 62%),' +
                'radial-gradient(42% 46% at 92% 78%, rgb(232 69 60 / 0.16) 0%, transparent 66%)',
            }}
          />

          <div className="relative mx-auto grid w-full max-w-[80rem] gap-12 px-4 pt-12 pb-16 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
            <div className="space-y-7">
              {/* The greeting, then what it actually means — the same move the
                  app makes on every card: Arabic first, gloss underneath. */}
              <div className="space-y-3">
                <ArabicText size="lg" as="p" className="text-taj block text-left">
                  أَهْلًا وَسَهْلًا
                </ArabicText>
                <p className="measure text-subh-soft text-sm leading-relaxed">
                  {home('greetingNote')}
                </p>
              </div>

              <h1 className="text-subh text-3xl leading-[1.15] font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                {home.rich('headline', {
                  brand: (chunks) => <span className="text-jamr">{chunks}</span>,
                })}
              </h1>

              <p className="measure text-subh-soft text-base leading-relaxed lg:text-lg">
                {home('guestBody')}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/review"
                  className="bg-jamr inline-flex min-h-14 items-center justify-center rounded-full px-7 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-100"
                >
                  {t('home.startReview')}
                </Link>
                <Link
                  href="/words"
                  className="bg-nahar-blue text-layl-deep inline-flex min-h-14 items-center justify-center rounded-full px-7 text-base font-semibold transition-transform hover:scale-[1.02] active:scale-100"
                >
                  {t('words.title')}
                </Link>
              </div>

              <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                {[
                  t('home.statWords', { count: totalWords }),
                  t('home.statQuran', { count: quranWords }),
                  t('home.statAudio'),
                ].map((stat) => (
                  <li
                    key={stat}
                    className="text-subh-soft flex items-center gap-2 text-sm"
                    data-numeric
                  >
                    <span aria-hidden className="bg-taj size-1.5 rounded-full" />
                    {stat}
                  </li>
                ))}
              </ul>
            </div>

            <HeroCard3D words={HERO_WORDS} hint={t('home.cardHint')} tone="dark" />
          </div>
        </section>

        {/* --- Decks ------------------------------------------------------ */}
        <section className="border-layl-line/60 border-t bg-[linear-gradient(180deg,rgb(18_50_76/.52),rgb(7_26_41/.22))]">
          <div className="mx-auto w-full max-w-[80rem] px-4 py-16 md:px-6 lg:py-24">
            <div className="flex flex-col gap-6 border-b border-layl-line/70 pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl space-y-4">
                <p className="text-taj flex items-center gap-3 text-xs font-semibold tracking-[0.2em] uppercase">
                  <span aria-hidden className="h-px w-8 bg-taj/70" />
                  {locale === 'bn' ? 'শেখার পথ' : 'A guided collection'}
                </p>
                <h2 className="text-subh text-3xl font-semibold tracking-tight lg:text-4xl">
                  {home('decksHeading')}
                </h2>
                <p className="text-subh-soft max-w-xl text-base leading-relaxed">
                  {home('decksBody')}
                </p>
              </div>
              <span className="text-subh-soft shrink-0 text-sm" data-numeric>
                {locale === 'bn' ? `${decks.length}টি সংগ্রহ` : `${decks.length} collections`}
              </span>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck, index) => {
                const featured = index === 0;
                return (
                  <li key={deck.id} className={featured ? 'sm:col-span-2' : undefined}>
                    <Link
                      href={`/review?deck=${deck.id}`}
                      className={cn(
                        'group relative isolate flex h-full min-h-56 flex-col overflow-hidden rounded-sheet border p-5 transition duration-300 sm:p-6',
                        featured
                          ? 'border-nahar-blue/50 bg-[radial-gradient(ellipse_at_100%_0%,rgb(71_166_223/.19),transparent_48%),linear-gradient(135deg,rgb(18_48_74/.98),rgb(7_26_41/.96))] lg:min-h-64 lg:p-8'
                          : 'border-layl-line/80 bg-layl-deep/65 hover:-translate-y-1 hover:border-nahar-blue/60 hover:bg-layl-deep',
                        'focus-visible:outline-nahar-blue',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'pointer-events-none absolute -end-4 -top-10 -z-10 select-none font-arabic leading-none text-white/[0.035]',
                          featured ? 'text-[15rem] lg:-top-16 lg:text-[20rem]' : 'text-[10rem]',
                        )}
                      >
                        ع
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-subh-soft flex items-center gap-2 text-[0.68rem] font-semibold tracking-[0.16em] uppercase">
                          <span className="text-nahar-blue" data-numeric>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span aria-hidden className="h-px w-5 bg-layl-line" />
                          {featured
                            ? locale === 'bn'
                              ? 'শুরু করুন'
                              : 'Start here'
                            : locale === 'bn'
                              ? 'শব্দের সংগ্রহ'
                              : 'Word collection'}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                            featured
                              ? 'border-nahar-blue/35 bg-nahar-blue/10 text-nahar-blue'
                              : 'border-layl-line text-taj',
                          )}
                          data-numeric
                        >
                          {t('home.statWords', { count: deck.wordCount })}
                        </span>
                      </div>

                      <div className="mt-7 max-w-2xl space-y-2">
                        <GlossText
                          script="bn"
                          className={cn(
                            'text-subh font-semibold tracking-tight',
                            featured ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-lg',
                          )}
                        >
                          {deck.title}
                        </GlossText>
                        <GlossText
                          script="bn"
                          className={cn(
                            'text-subh-soft leading-relaxed',
                            featured ? 'max-w-xl text-sm sm:text-base' : 'text-sm',
                          )}
                        >
                          {deck.description}
                        </GlossText>
                      </div>

                      <div className="text-nahar-blue mt-auto flex items-center gap-2 pt-6 text-sm font-semibold">
                        <span>{locale === 'bn' ? 'শেখা শুরু করুন' : 'Begin learning'}</span>
                        <span
                          aria-hidden
                          className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                        >
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* --- Closing ---------------------------------------------------- */}
        <section className="border-layl-line/60 border-t">
          <div className="mx-auto w-full max-w-[80rem] px-4 py-16 text-center md:px-6 lg:py-20">
            <h2 className="text-subh mx-auto max-w-3xl text-2xl leading-snug font-semibold lg:text-3xl">
              {home('closingHeading')}
            </h2>
            <div className="mt-7 flex justify-center">
              <Link
                href="/review"
                className="bg-jamr inline-flex min-h-14 items-center justify-center rounded-full px-8 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-100"
              >
                {t('home.startReview')}
              </Link>
            </div>
            <p className="text-subh-soft mt-4 text-sm">{home('closingNote')}</p>
          </div>
        </section>

        {/* --- Footer ----------------------------------------------------- */}
        {/* The policy pages are linked from here because a consent screen is
            only valid while Google can still reach them from the home page. */}
        <footer className="border-layl-line/60 border-t">
          <div className="text-subh-soft mx-auto flex w-full max-w-[80rem] flex-col items-center gap-3 px-4 py-8 text-sm sm:flex-row sm:justify-between md:px-6">
            <p>{t('app.name')}</p>
            <nav className="flex gap-5">
              <Link href="/privacy" className="hover:text-subh underline-offset-4 hover:underline">
                {legal('privacyTitle')}
              </Link>
              <Link href="/terms" className="hover:text-subh underline-offset-4 hover:underline">
                {legal('termsTitle')}
              </Link>
            </nav>
          </div>
        </footer>
      </main>
    </div>
  );
}
