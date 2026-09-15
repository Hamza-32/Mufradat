import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { Panel } from '@/components/ui/Panel';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText, MeaningList } from '@/components/text/GlossText';
import { AudioButton } from '@/components/words/AudioButton';
import { getWordDetail } from '@/lib/words/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const word = await getWordDetail((await params).id);
  if (!word) return { title: 'শব্দ' };
  return {
    title: `${word.arabic} — ${word.bengaliMeanings[0] ?? ''}`,
    description: `${word.arabic} (${word.transliteration}): ${word.bengaliMeanings.join(', ')} · ${word.englishMeanings.join(', ')}`,
  };
}

/**
 * Phone: one scrolling column. Desktop: the word and its examples in the main
 * column, with the root family and the learner's notes in a side column — the
 * width is used for related information, not for wider paragraphs.
 */
export default async function WordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const word = await getWordDetail((await params).id);
  if (!word) notFound();

  const t = await getTranslations('word');
  const locale = await getLocale();

  const grammar = [
    t(`pos.${word.partOfSpeech}`),
    word.gender ? t(`gender.${word.gender}`) : null,
    word.verbForm ? t('verbForm', { form: word.verbForm }) : null,
  ].filter(Boolean);

  return (
    <AppShell>
      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
        <article className="space-y-8">
          <header className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <ArabicText size="display" as="h1" className="text-nil">
                {word.arabic}
              </ArabicText>
              <AudioButton
                path={word.audioPath}
                label={t('playAudio')}
                missingLabel={t('audioMissing')}
                className="mt-2 shrink-0"
              />
            </div>

            <p className="text-pathor flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-latin">{word.transliteration}</span>
              {grammar.map((item) => (
                <span key={String(item)}>{item}</span>
              ))}
            </p>

            {word.needsReview ? (
              <p className="border-shingraf bg-shingraf-wash/40 text-dawat border-s-2 p-2 text-xs">
                {t('needsReview')}
              </p>
            ) : null}

            <MeaningList bengali={word.bengaliMeanings} english={word.englishMeanings} />
          </header>

          {word.pluralArabic || word.presentTense ? (
            <section className="space-y-3">
              <SectionHeading level={3}>{t('forms')}</SectionHeading>
              <dl className="grid gap-3 sm:grid-cols-2">
                {word.pluralArabic ? (
                  <Panel className="p-3">
                    <dt className="text-pathor text-xs">{t('plural')}</dt>
                    <ArabicText as="dd" size="sm" className="mt-1 block">
                      {word.pluralArabic}
                    </ArabicText>
                  </Panel>
                ) : null}
                {word.presentTense ? (
                  <Panel className="p-3">
                    <dt className="text-pathor text-xs">{t('present')}</dt>
                    <ArabicText as="dd" size="sm" className="mt-1 block">
                      {word.presentTense}
                    </ArabicText>
                  </Panel>
                ) : null}
                {word.masdar ? (
                  <Panel className="p-3">
                    <dt className="text-pathor text-xs">{t('masdar')}</dt>
                    <ArabicText as="dd" size="sm" className="mt-1 block">
                      {word.masdar}
                    </ArabicText>
                  </Panel>
                ) : null}
              </dl>
            </section>
          ) : null}

          {word.editorNote ? (
            <section className="space-y-3">
              <SectionHeading level={3}>{t('editorNote')}</SectionHeading>
              <GlossText as="p" script="auto" measure className="text-dawat text-base">
                {word.editorNote}
              </GlossText>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeading level={3}>{t('examples')}</SectionHeading>
            {word.examples.length === 0 ? (
              <p className="text-pathor text-sm">{t('noExamples')}</p>
            ) : (
              <ul className="space-y-5">
                {word.examples.map((example) => (
                  <li key={example.id} className="border-hairline space-y-1 border-s-2 ps-4">
                    <ArabicText as="p" size="sm">
                      {example.arabic}
                    </ArabicText>
                    <GlossText as="p" script="bn" measure className="text-base">
                      {example.bengali}
                    </GlossText>
                    <GlossText as="p" script="en" measure className="text-pathor text-sm">
                      {example.english}
                    </GlossText>
                    {example.sourceRef ? (
                      <p className="font-latin text-shingraf text-xs">{example.sourceRef}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </article>

        <aside className="mt-10 space-y-8 lg:mt-0">
          {word.root ? (
            <section className="space-y-3">
              <SectionHeading level={3}>{t('rootFamily')}</SectionHeading>
              <ArabicText size="sm" className="text-shingraf">
                {word.root}
              </ArabicText>
              {word.rootFamily.length === 0 ? (
                <p className="text-pathor text-sm">{t('noRootFamily')}</p>
              ) : (
                <ul className="divide-hairline-soft divide-y">
                  {word.rootFamily.map((relative) => (
                    <li key={relative.id}>
                      <Link
                        href={`/words/${relative.id}`}
                        className="min-h-touch hover:text-nil flex items-baseline justify-between gap-3 py-2"
                      >
                        <ArabicText size="sm">{relative.arabic}</ArabicText>
                        <GlossText script="bn" className="text-pathor text-sm">
                          {relative.bengaliMeanings[0] ?? ''}
                        </GlossText>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {word.decks.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading level={3}>{t('inDecks')}</SectionHeading>
              <ul className="space-y-1">
                {word.decks.map((deck) => (
                  <li key={deck.id}>
                    <Link
                      href={`/words?deck=${deck.id}`}
                      className="min-h-touch text-nil flex items-center text-sm hover:underline"
                    >
                      {locale === 'bn' ? deck.titleBengali : deck.titleEnglish}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeading level={3}>{t('myNotes')}</SectionHeading>
            <p className="text-pathor text-sm">{t('notesPrompt')}</p>
            <Link
              href={`/notes?word=${word.id}&new=1`}
              className="min-h-touch rounded-ui border-hairline bg-chuna hover:bg-nil-wash inline-flex items-center border px-4 text-sm"
            >
              {t('addNote')}
            </Link>
          </section>
        </aside>
      </PageBody>
    </AppShell>
  );
}
