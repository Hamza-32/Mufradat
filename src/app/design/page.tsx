import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DeckRowSkeleton, Skeleton, WordRowSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText, MeaningList } from '@/components/text/GlossText';
import { SheetDemo } from './SheetDemo';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};

/**
 * The design system on one page, so it can be checked at 360, 414, 768, 1024,
 * 1280 and 1600 without hunting through the app. Not linked from the
 * navigation; it is a reviewer's page, not a learner's.
 */

const SWATCHES = [
  {
    token: 'nil',
    hex: '#6AB7EA',
    note: 'Daylight blue — Arabic headwords, primary action, focus ring',
  },
  { token: 'dawat', hex: '#EEF4FA', note: 'The ink, read light on dark — all body text' },
  { token: 'kagoj', hex: '#0B2438', note: 'Night — the page ground' },
  { token: 'chuna', hex: '#12304A', note: 'Raised surfaces, one step nearer than the ground' },
  { token: 'shingraf', hex: '#EF6152', note: "Cinnabar — the rubricator's red. Marks only" },
  { token: 'pathor', hex: '#9DB4C8', note: 'Stone — secondary text and hairlines' },
] as const;

export default function DesignPage(): ReactNode {
  return (
    <AppShell>
      <PageBody className="space-y-10 pb-24 lg:pb-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Design system</h1>
          <p className="measure text-pathor text-base">
            Check this page at 360, 414, 768, 1024, 1280 and 1600. The navigation should be a bottom
            bar, then a rail, then a sidebar.
          </p>
        </div>

        {/* --- Palette ----------------------------------------------------- */}
        <section className="space-y-3">
          <SectionHeading>Palette</SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SWATCHES.map((swatch) => (
              <li key={swatch.token}>
                <Panel radius="data" className="flex items-stretch gap-3 overflow-hidden">
                  <span
                    aria-hidden="true"
                    className="border-hairline w-14 shrink-0 border-e"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="py-2 pe-3">
                    <span className="block text-sm font-semibold">{swatch.token}</span>
                    <span className="text-pathor block text-xs" data-numeric>
                      {swatch.hex}
                    </span>
                    <span className="text-pathor mt-1 block text-xs">{swatch.note}</span>
                  </span>
                </Panel>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Type -------------------------------------------------------- */}
        <section className="space-y-4">
          <SectionHeading>Type</SectionHeading>

          <Panel className="space-y-4 p-4">
            <p className="text-pathor text-xs">
              Arabic — Amiri, two steps larger than everything else, line-height 2.0
            </p>
            <ArabicText size="display" as="p" className="text-nil">
              كِتَاب
            </ArabicText>
            <ArabicText size="lg" as="p">
              ذَلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ
            </ArabicText>
            <ArabicText size="base" as="p" rubricate>
              مَا مَعْنَى هَذِهِ الْكَلِمَةِ؟
            </ArabicText>
            <p className="text-pathor text-xs">
              The line above is rubricated: marks in cinnabar, letters in ink.
            </p>
            <ArabicText size="base" as="p" showHarakat={false}>
              كِتَاب
            </ArabicText>
            <p className="text-pathor text-xs">
              Harakat hidden — the screen reader still receives the vowelled form.
            </p>
          </Panel>

          <Panel className="space-y-3 p-4">
            <p className="text-pathor text-xs">Bengali — Noto Serif Bengali</p>
            <GlossText as="p" script="bn" measure className="text-lg">
              কুরআনে সবচেয়ে বেশি আসে যে শব্দগুলো। এই ৩০০ শব্দ জানলে অনুবাদ ছাড়াই অনেকটা বোঝা যায়।
            </GlossText>
            <p className="text-pathor text-xs">Latin — IBM Plex Sans, tabular figures</p>
            <GlossText as="p" script="en" measure className="text-base">
              The words that recur most often in the Quran. Learn these 300 and much of the text
              opens up without a translation.
            </GlossText>
          </Panel>

          <Panel className="space-y-2 p-4">
            <p className="text-pathor text-xs">
              Mixed scripts in one block, with dir=&quot;auto&quot;
            </p>
            <GlossText as="p" script="auto" measure>
              ذَهَبَ إِلَى السُّوقِ
            </GlossText>
            <GlossText as="p" script="auto" measure>
              সে বাজারে গেল — ذهب is unrelated to ذَهَب (gold).
            </GlossText>
          </Panel>

          <Panel className="p-4">
            <MeaningList bengali={['বই', 'কিতাব']} english={['book', 'scripture']} />
          </Panel>
        </section>

        {/* --- Controls ---------------------------------------------------- */}
        <section className="space-y-4">
          <SectionHeading>Controls</SectionHeading>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg">
              Start review
            </Button>
            <Button variant="secondary">Browse decks</Button>
            <Button variant="quiet">Skip for now</Button>
            <Button variant="rubric" size="sm">
              Reset progress
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="max-w-sm space-y-2">
            <ProgressBar value={118} max={300} label="118 of 300 words learned" />
            <ProgressBar value={8} max={23} label="8 of 23 reviewed" tone="shingraf" />
          </div>
          <SheetDemo />
        </section>

        {/* --- States ------------------------------------------------------ */}
        <section className="space-y-4">
          <SectionHeading>Loading, empty, error</SectionHeading>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="p-4">
              <p className="text-pathor mb-2 text-xs">Loading</p>
              <DeckRowSkeleton />
              <WordRowSkeleton />
              <Skeleton className="h-4 w-32" />
            </Panel>
            <Panel className="p-4">
              <p className="text-pathor mb-2 text-xs">Empty</p>
              <EmptyState
                title="এখনও কোনো নোট নেই"
                body="যে শব্দটা মনে থাকে না, সেটা নিয়ে প্রথম নোটটা লিখুন।"
                action={{ label: 'নোট লিখুন', href: '/notes' }}
                className="py-2"
              />
            </Panel>
            <Panel className="p-4">
              <p className="text-pathor mb-2 text-xs">Error</p>
              <ErrorState
                title="শব্দগুলো আনা যায়নি"
                body="সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
                retryLabel="আবার চেষ্টা করুন"
              />
            </Panel>
          </div>
        </section>
      </PageBody>
    </AppShell>
  );
}
