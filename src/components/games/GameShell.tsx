'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { CloseIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';

export type Phase = 'loading' | 'intro' | 'playing' | 'over' | 'error' | 'empty';

/**
 * Every game is 60–90 seconds, has a timer, and ends the same way. That
 * sameness is the point: the shell is identical so a learner learns one set of
 * rules, and each game only has to bring its own board.
 *
 * The timer is derived from a wall-clock start rather than counted down by
 * interval ticks, so a backgrounded tab on a phone cannot hand out extra time.
 */
export function useGameClock(durationSeconds: number): {
  secondsLeft: number;
  start: () => void;
  stop: () => number;
  running: boolean;
} {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(durationSeconds - elapsed)));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt, durationSeconds]);

  const start = useCallback(() => {
    setStartedAt(Date.now());
    setSecondsLeft(durationSeconds);
  }, [durationSeconds]);

  const stop = useCallback(() => {
    const elapsed = startedAt === null ? 0 : Date.now() - startedAt;
    setStartedAt(null);
    return elapsed;
  }, [startedAt]);

  return { secondsLeft, start, stop, running: startedAt !== null };
}

export function GameShell({
  title,
  howTo,
  phase,
  secondsLeft,
  duration,
  score,
  onStart,
  onRetry,
  summary,
  children,
}: {
  title: string;
  howTo: string;
  phase: Phase;
  secondsLeft: number;
  duration: number;
  score: number;
  onStart: () => void;
  onRetry: () => void;
  summary?: { correct: number; total: number } | undefined;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('games');
  const announced = useRef(false);

  // Announce the last ten seconds once, for anyone not watching the clock.
  useEffect(() => {
    if (phase === 'playing' && secondsLeft <= 10 && !announced.current) announced.current = true;
    if (phase !== 'playing') announced.current = false;
  }, [phase, secondsLeft]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4 lg:max-w-4xl lg:p-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/games"
          aria-label={t('exit')}
          className="size-touch rounded-ui text-pathor hover:bg-nil-wash hover:text-nil inline-flex shrink-0 items-center justify-center"
        >
          <CloseIcon width={20} height={20} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {phase === 'playing' ? (
          <>
            <span className="text-pathor text-sm" data-numeric aria-label={t('scoreLabel')}>
              {score}
            </span>
            <span
              role="timer"
              aria-live={secondsLeft <= 10 ? 'polite' : 'off'}
              className={cn(
                'min-w-10 text-end text-sm font-semibold',
                secondsLeft <= 10 ? 'text-shingraf' : 'text-nil',
              )}
              data-numeric
            >
              {t('secondsLeft', { seconds: secondsLeft })}
            </span>
          </>
        ) : null}
      </header>

      {phase === 'playing' ? (
        <ProgressBar
          value={secondsLeft}
          max={duration}
          label={t('timeRemaining')}
          tone={secondsLeft <= 10 ? 'shingraf' : 'nil'}
          className="mb-4"
        />
      ) : null}

      {phase === 'loading' ? (
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="min-h-64 flex-1" />
        </div>
      ) : phase === 'error' ? (
        <ErrorState
          title={t('errorTitle')}
          body={t('errorBody')}
          retryLabel={t('retry')}
          onRetry={onRetry}
        />
      ) : phase === 'empty' ? (
        <div className="flex flex-1 flex-col justify-center gap-4 text-center">
          <p className="text-lg font-semibold">{t('notEnoughWordsTitle')}</p>
          <p className="text-pathor text-base">{t('notEnoughWordsBody')}</p>
          <Link href="/words" className="text-nil underline">
            {t('browseWords')}
          </Link>
        </div>
      ) : phase === 'intro' ? (
        <div className="flex flex-1 flex-col justify-center gap-6 text-center">
          <p className="measure text-pathor mx-auto text-base">{howTo}</p>
          <Button variant="primary" size="lg" onClick={onStart} className="mx-auto">
            {t('start')}
          </Button>
        </div>
      ) : phase === 'over' ? (
        <div className="flex flex-1 flex-col justify-center gap-5 text-center">
          <p className="text-2xl font-semibold">{t('roundOver')}</p>
          <p className="text-pathor text-base" data-numeric>
            {t('roundSummary', {
              score,
              correct: summary?.correct ?? 0,
              total: summary?.total ?? 0,
            })}
          </p>
          <p className="text-pathor text-sm">{t('countsAsStudy')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" size="lg" onClick={onStart}>
              {t('playAgain')}
            </Button>
            <ButtonLink href="/games" variant="secondary" size="lg">
              {t('otherGames')}
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="pb-safe flex min-h-0 flex-1 flex-col">{children}</div>
      )}
    </div>
  );
}
