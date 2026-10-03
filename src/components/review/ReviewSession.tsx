'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/Sheet';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { CloseIcon } from '@/components/icons';
import { Flashcard } from './Flashcard';
import { guestAdapter, newEventId, serverAdapter } from '@/lib/review/adapters';
import { reinsert } from '@/lib/review/queue-core';
import type { Grade } from '@/lib/review/scheduler';
import type { QueueResponse, QueueResponseItem } from '@/lib/review/server';

type Status = 'loading' | 'ready' | 'error' | 'finished';

/**
 * One session, two input languages: thumb on a phone, number row on a desktop.
 * The card component owns the gesture; this component owns the queue, the
 * keyboard, the progress and the ending.
 */
export function ReviewSession({
  signedIn,
  deckId,
}: {
  signedIn: boolean;
  deckId?: string;
}): ReactNode {
  const t = useTranslations('review');
  const router = useRouter();
  const adapter = useMemo(() => (signedIn ? serverAdapter() : guestAdapter()), [signedIn]);

  const [status, setStatus] = useState<Status>('loading');
  const [queue, setQueue] = useState<QueueResponseItem[]>([]);
  const [meta, setMeta] = useState<QueueResponse | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const shownAt = useRef<number>(Date.now());
  const total = useRef(0);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await adapter.loadQueue(deckId);
      setMeta(response);
      setQueue(response.items);
      total.current = response.items.length;
      setStatus(response.items.length === 0 ? 'finished' : 'ready');
      setRevealed(false);
      shownAt.current = Date.now();
    } catch {
      setStatus('error');
    }
  }, [adapter, deckId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[0];

  const grade = useCallback(
    (value: Grade) => {
      if (!current || !revealed) return;

      const elapsedMs = Math.min(Date.now() - shownAt.current, 600_000);
      const rest = queue.slice(1);
      // "Again" means the learner did not know it, so the card comes back in
      // this sitting rather than disappearing for a day.
      const next = value === 1 ? reinsert(rest, current) : rest;

      setQueue(next);
      setGraded((count) => count + 1);
      setRevealed(false);
      shownAt.current = Date.now();
      if (next.length === 0) setStatus('finished');

      // Fire and forget: the answer is already safe — either sent, or queued on
      // the device by the outbox — and a slow network must never hold up the
      // next card. Anything waiting is reported once, by the shell.
      void adapter.submit({
        wordId: current.wordId,
        deckId: current.deckId,
        grade: value,
        elapsedMs,
        clientEventId: newEventId(),
      });
    },
    [adapter, current, queue, revealed],
  );

  // Desktop keyboard control. Pointer-coarse devices get nothing bound, so a
  // phone keyboard popping up cannot grade a card by accident.
  useEffect(() => {
    if (status !== 'ready') return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        if (target?.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (event.key === 'Escape') {
        router.push('/');
        return;
      }
      if (event.key === '?') {
        setShortcutsOpen((open) => !open);
        return;
      }
      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        grade(Number(event.key) as Grade);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [grade, revealed, router, status]);

  if (status === 'loading') {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mx-auto mb-6 w-full max-w-3xl space-y-5 pt-1 pb-4">
          <Skeleton className="h-14 w-44 rounded-xl" />
          <Skeleton className="h-7 w-full rounded-full" />
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <Skeleton className="h-[25rem] rounded-[1.75rem] sm:h-[28rem]" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <ErrorState
          title={t('errorTitle')}
          body={t('errorBody')}
          retryLabel={t('retry')}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  if (status === 'finished' || !current) {
    const done = graded > 0;
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-semibold">{done ? t('doneTitle') : t('nothingDueTitle')}</h1>
        <p className="text-pathor text-base">
          {done
            ? t('doneBody', { count: graded })
            : t('nothingDueBody', { count: meta?.limits.reviewsPerDay ?? 0 })}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/" variant="primary" size="lg">
            {t('backHome')}
          </ButtonLink>
          <ButtonLink href="/words" variant="secondary" size="lg">
            {t('browseWords')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const remaining = queue.length;
  const seen = graded;
  const sessionTotal = Math.max(total.current, seen + remaining);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
      <header className="bg-kagoj/95 sticky top-0 z-10 mx-auto mb-6 w-full max-w-3xl space-y-5 pt-1 pb-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-dawat text-xl font-semibold sm:text-2xl">{t('sessionTitle')}</h1>
            <p className="text-pathor text-xs sm:text-sm">{t('sessionSubtitle')}</p>
          </div>
          <Link
            href="/"
            aria-label={t('exit')}
            className="text-pathor border-hairline hover:border-nil/40 hover:bg-nil-wash hover:text-nil inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-3 sm:px-4"
          >
            <CloseIcon width={16} height={16} />
            <span className="hidden text-xs font-semibold sm:inline">{t('exit')}</span>
          </Link>
        </div>
        <div className="space-y-2">
          <div className="text-pathor flex items-center justify-between gap-3 text-xs">
            <span>{t('sessionProgress')}</span>
            <span className="text-nil" data-numeric>
              {t('progressCount', { done: seen, total: sessionTotal })}
            </span>
          </div>
          <ProgressBar
            value={seen}
            max={sessionTotal}
            label={t('progressLabel', { done: seen, total: sessionTotal })}
            className="h-1 rounded-full"
          />
        </div>
      </header>

      <Flashcard
        key={current.wordId}
        item={current}
        revealed={revealed}
        onReveal={() => {
          setRevealed(true);
        }}
        onGrade={grade}
        showSwipeHint={seen < 3}
      />

      {/* Desktop only: the shortcut hints, and the overlay behind "?". */}
      <div className="mt-5 hidden justify-center lg:flex">
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="text-pathor hover:text-nil inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs transition-colors"
        >
          <span aria-hidden className="font-latin border-hairline rounded-md border px-1.5 py-0.5">
            ?
          </span>
          {t('shortcutsTitle')}
        </button>
      </div>

      <Sheet
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        title={t('shortcutsTitle')}
        closeLabel={t('close')}
      >
        <dl className="space-y-2 text-sm">
          {[
            ['1 – 4', t('shortcutGrade')],
            ['space', t('shortcutFlip')],
            ['esc', t('shortcutExit')],
            ['?', t('shortcutHelp')],
          ].map(([key, description]) => (
            <div key={key} className="flex items-baseline justify-between gap-4">
              <dt className="font-latin text-nil">{key}</dt>
              <dd className="text-pathor">{description}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </div>
  );
}
