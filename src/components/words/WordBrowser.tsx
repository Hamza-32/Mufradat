'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { AudioButton } from '@/components/words/AudioButton';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SearchField } from '@/components/ui/SearchField';
import { Chip } from '@/components/ui/Chip';
import type { WordSearchResult, WordSummary } from '@/lib/words/queries';

interface Filters {
  deck: string;
  pos: string;
}

const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'particle', 'phrase'] as const;

/** Words per page. Matches the server-rendered first page in words/page.tsx. */
const PAGE_SIZE = 24;

/**
 * Phone: one column of full-bleed rows, a sticky search field, filters in a
 * bottom sheet. Desktop: a filter rail beside a two- or three-column grid.
 * Same data, two layouts — the desktop one is not the phone one with margin.
 */
export function WordBrowser({
  initial,
  decks,
}: {
  initial: WordSearchResult;
  decks: { id: string; slug: string; title: string }[];
}): ReactNode {
  const t = useTranslations('words');
  const locale = useLocale();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ deck: '', pos: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Typing on a phone keyboard should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (query) search.set('q', query);
    if (filters.deck) search.set('deck', filters.deck);
    if (filters.pos) search.set('pos', filters.pos);
    return search.toString();
  }, [query, filters]);

  const isDefaultView = params === '';

  // Numbered pages rather than an endless scroll. A learner working through a
  // three-hundred word deck needs to know where they are in it and be able to
  // come back to the same place; an infinite list can tell them neither.
  const [page, setPage] = useState(1);

  // Any change of search or filter returns to page one. Staying on page seven
  // of a result set that now has two would show an empty list.
  useEffect(() => {
    setPage(1);
  }, [params]);

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['words', params, page],
    queryFn: async (): Promise<WordSearchResult> => {
      const search = new URLSearchParams(params);
      search.set('limit', String(PAGE_SIZE));
      if (page > 1) search.set('offset', String((page - 1) * PAGE_SIZE));
      const response = await fetch(`/api/words?${search.toString()}`);
      if (!response.ok) throw new Error('search failed');
      return (await response.json()) as WordSearchResult;
    },
    // The server already rendered the unfiltered first page. Spread rather than
    // set to undefined: `exactOptionalPropertyTypes` wants the key absent.
    ...(isDefaultView && page === 1 ? { initialData: initial } : {}),
    placeholderData: keepPreviousData,
  });

  const words = data?.words ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);

  // Changing page should put the learner at the top of the new page, not
  // halfway down it where the old scroll position left them.
  const listTop = useRef<HTMLDivElement | null>(null);
  function goTo(next: number): void {
    setPage(next);
    listTop.current?.scrollIntoView({ block: 'start' });
  }

  const activeFilters = (filters.deck ? 1 : 0) + (filters.pos ? 1 : 0);

  const activeNames = [
    filters.deck
      ? {
          key: 'deck',
          label: decks.find((deck) => deck.id === filters.deck)?.title ?? filters.deck,
          clear: () => {
            setFilters((f) => ({ ...f, deck: '' }));
          },
        }
      : null,
    filters.pos
      ? {
          key: 'pos',
          label: t(`pos.${filters.pos}`),
          clear: () => {
            setFilters((f) => ({ ...f, pos: '' }));
          },
        }
      : null,
  ].filter((entry): entry is { key: string; label: string; clear: () => void } => entry !== null);

  const filterControls = (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-dawat text-sm font-semibold">{t('filterDeck')}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={filters.deck === ''}
            onClick={() => {
              setFilters((f) => ({ ...f, deck: '' }));
            }}
          >
            {t('all')}
          </Chip>
          {decks.map((deck) => (
            <Chip
              key={deck.id}
              active={filters.deck === deck.id}
              onClick={() => {
                setFilters((f) => ({ ...f, deck: deck.id }));
              }}
            >
              {deck.title}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-dawat text-sm font-semibold">{t('filterPos')}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={filters.pos === ''}
            onClick={() => {
              setFilters((f) => ({ ...f, pos: '' }));
            }}
          >
            {t('all')}
          </Chip>
          {PARTS_OF_SPEECH.map((pos) => (
            <Chip
              key={pos}
              active={filters.pos === pos}
              onClick={() => {
                setFilters((f) => ({ ...f, pos }));
              }}
            >
              {t(`pos.${pos}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      {/* Desktop: a persistent filter rail. */}
      <aside className="hidden lg:block">
        <div className="sticky top-6">{filterControls}</div>
      </aside>

      <div className="space-y-4">
        <div className="bg-kagoj/95 sticky top-14 z-10 -mx-4 px-4 py-3 md:static md:mx-0 md:px-0 md:py-0">
          <div className="flex gap-2">
            <SearchField
              value={input}
              onChange={setInput}
              placeholder={t('searchPlaceholder')}
              label={t('searchLabel')}
            />
            <Button
              variant="secondary"
              className="lg:hidden"
              onClick={() => {
                setFiltersOpen(true);
              }}
            >
              {activeFilters > 0 ? t('filtersWithCount', { count: activeFilters }) : t('filters')}
            </Button>
          </div>
          <p aria-live="polite" className="sr-only">
            {data ? t('resultCount', { count: total }) : ''}
          </p>
        </div>

        {isError ? (
          <ErrorState
            title={t('errorTitle')}
            body={t('errorBody')}
            retryLabel={t('retry')}
            onRetry={() => void refetch()}
          />
        ) : isPending || !data ? (
          <WordListSkeleton />
        ) : words.length === 0 ? (
          <EmptyState
            title={t('emptyTitle', { query })}
            body={t('emptyBody')}
            action={{
              label: t('clearSearch'),
              onClick: () => {
                setInput('');
                setFilters({ deck: '', pos: '' });
              },
            }}
          />
        ) : (
          <>
            <div ref={listTop} className="scroll-mt-24 space-y-2">
              {/* Every active filter is named here, with a way off it. Before
                  this the count could drop from 300 to 70 with the only
                  explanation a chip in a rail the learner had scrolled past. */}
              {activeFilters > 0 ? (
                <ul aria-label={t('activeFilters')} className="flex flex-wrap items-center gap-2">
                  {activeNames.map((entry) => (
                    <li key={entry.key}>
                      <button
                        type="button"
                        onClick={entry.clear}
                        aria-label={t('removeFilter', { name: entry.label })}
                        className="min-h-touch border-nil-soft bg-nil-wash text-dawat hover:border-nil inline-flex items-center gap-1.5 rounded-full border px-3 text-sm transition-colors"
                      >
                        {entry.label}
                        <span aria-hidden className="text-pathor">
                          ×
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ deck: '', pos: '' });
                      }}
                      className="min-h-touch text-nil px-2 text-sm underline-offset-4 hover:underline"
                    >
                      {t('clearFilters')}
                    </button>
                  </li>
                </ul>
              ) : null}

              <p className="text-pathor text-sm" data-numeric>
                {t('showingRange', { from: firstShown, to: lastShown, total })}
              </p>
            </div>
            <ul
              className={cn(
                'divide-hairline-soft divide-y md:grid md:grid-cols-2 md:gap-3 md:divide-y-0',
                '3xl:grid-cols-4 xl:grid-cols-3',
                // Only the first fetch dims the list. Dimming it while the next
                // page loads would flicker the words already on screen.
                isFetching && 'opacity-70 transition-opacity',
              )}
            >
              {words.map((word) => (
                <li key={word.id} className="md:contents">
                  <WordCard word={word} />
                </li>
              ))}
            </ul>

            {pageCount > 1 ? (
              <nav
                aria-label={t('pagination')}
                className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => {
                    goTo(page - 1);
                  }}
                >
                  {t('prevPage')}
                </Button>

                {pageWindow(page, pageCount).map((entry, i) =>
                  entry === 'gap' ? (
                    <span key={`gap-${i}`} aria-hidden className="text-pathor-soft px-1">
                      …
                    </span>
                  ) : (
                    <Button
                      key={entry}
                      variant={entry === page ? 'primary' : 'secondary'}
                      size="sm"
                      aria-label={t('goToPage', { page: entry })}
                      aria-current={entry === page ? 'page' : undefined}
                      onClick={() => {
                        goTo(entry);
                      }}
                      className="min-w-touch"
                    >
                      <span data-numeric>{formatNumber(entry, locale)}</span>
                    </Button>
                  ),
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === pageCount}
                  onClick={() => {
                    goTo(page + 1);
                  }}
                >
                  {t('nextPage')}
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('filters')}
        closeLabel={t('close')}
        footer={
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setFiltersOpen(false);
            }}
          >
            {t('applyFilters')}
          </Button>
        }
      >
        {filterControls}
      </Sheet>
    </div>
  );
}

/**
 * Which page numbers to show. Always the first and last, plus the current page
 * and its immediate neighbours; anything skipped becomes a single ellipsis. A
 * twenty-page deck must not render twenty buttons on a 390px phone.
 */
function pageWindow(current: number, count: number): (number | 'gap')[] {
  const wanted = new Set([1, count, current - 1, current, current + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const n of pages) {
    if (previous && n - previous > 1) out.push('gap');
    out.push(n);
    previous = n;
  }
  return out;
}

/** Page numbers follow the UI language, so Bengali gets Bengali numerals. */
function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en').format(value);
}

function WordCard({ word }: { word: WordSummary }): ReactNode {
  const t = useTranslations('word');
  return (
    // The whole card is the link, but the pronunciation has to stay a real
    // button: a learner scanning the list wants to hear a word without opening
    // it. A stretched pseudo-element carries the link's hit area, so the button
    // can sit beside it instead of nested inside an anchor.
    <div
      className={cn(
        'min-h-touch md:rounded-ui md:border-hairline relative flex items-start gap-2 py-4 md:border',
        'md:bg-chuna md:hover:border-nil-soft md:hover:bg-nil-wash/40 md:p-4 md:transition-colors',
        'focus-within:border-nil-soft',
      )}
    >
      <Link
        href={`/words/${word.id}`}
        className="before:rounded-ui flex min-w-0 flex-1 flex-col gap-1 before:absolute before:inset-0"
      >
        <div className="flex items-baseline justify-between gap-3">
          <ArabicText size="sm" className="text-nil">
            {word.arabic}
          </ArabicText>
          <span className="font-latin text-pathor-soft shrink-0 text-xs">
            {word.transliteration}
          </span>
        </div>
        <GlossText script="bn" className="text-dawat text-base">
          {word.bengaliMeanings.join(', ')}
        </GlossText>
        <GlossText script="en" className="text-pathor text-sm">
          {word.englishMeanings.join(', ')}
        </GlossText>
      </Link>
      <AudioButton
        path={word.audioPath}
        label={t('playAudio')}
        missingLabel={t('audioMissing')}
        className="relative shrink-0"
      />
    </div>
  );
}

function WordListSkeleton(): ReactNode {
  return (
    <ul className="divide-hairline-soft divide-y md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 xl:grid-cols-3">
      {Array.from({ length: 8 }, (_, index) => (
        <li
          key={index}
          className="md:rounded-ui md:border-hairline md:bg-chuna space-y-2 py-4 md:border md:p-4"
        >
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </li>
      ))}
    </ul>
  );
}
