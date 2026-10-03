'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { AudioButton } from '@/components/words/AudioButton';
import { Button } from '@/components/ui/Button';
import type { Grade } from '@/lib/review/scheduler';
import type { QueueResponseItem } from '@/lib/review/server';

const GRADES: readonly Grade[] = [1, 2, 3, 4];

/** Distance in px before a drag counts as a grade rather than a scroll. */
const SWIPE_THRESHOLD = 90;

export function Flashcard({
  item,
  revealed,
  onReveal,
  onGrade,
  showSwipeHint,
}: {
  item: QueueResponseItem;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  showSwipeHint: boolean;
}): ReactNode {
  const t = useTranslations('review');
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  // A new card must start face down, whatever the previous one was doing.
  useEffect(() => {
    setDrag(0);
  }, [item.wordId]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!revealed || event.pointerType === 'mouse') return;
      start.current = event.clientX;
    },
    [revealed],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setDrag(event.clientX - start.current);
  }, []);

  const onPointerUp = useCallback(() => {
    if (start.current === null) return;
    const distance = drag;
    start.current = null;
    setDrag(0);
    // Left is "again", right is "good": the two answers that cover most of a
    // session. Hard and easy stay on the buttons, where a deliberate choice
    // belongs.
    if (distance <= -SWIPE_THRESHOLD) onGrade(1);
    else if (distance >= SWIPE_THRESHOLD) onGrade(3);
  }, [drag, onGrade]);

  const tilt = Math.max(-1, Math.min(1, drag / (SWIPE_THRESHOLD * 2)));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={
          drag === 0 ? undefined : { transform: `translateX(${drag}px) rotate(${tilt * 2}deg)` }
        }
        className={cn(
          'border-nil/25 relative isolate overflow-hidden rounded-[1.75rem] border text-center',
          'bg-[radial-gradient(ellipse_at_50%_15%,rgb(71_166_223/.12),transparent_65%),linear-gradient(150deg,#102e45,#071a29)]',
          'shadow-[0_24px_70px_-40px_rgb(0_0_0/.9)]',
          'touch-pan-y select-none',
          drag === 0 && 'ease-card transition-transform duration-200',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <span className="text-pathor text-xs font-semibold">{t('meaningPrompt')}</span>
          <span className="border-hairline bg-kagoj/60 text-pathor inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span
              aria-hidden
              className={cn('size-1.5 rounded-full', item.isNew ? 'bg-taj' : 'bg-nil')}
            />
            {t(item.isNew ? 'newWord' : 'reviewWord')}
          </span>
        </div>

        <div className="relative flex min-h-60 flex-col items-center justify-center gap-3 px-5 py-5 sm:min-h-64 sm:py-6">
          <div
            aria-hidden
            className="border-nil/10 pointer-events-none absolute top-1/2 left-1/2 -z-10 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full border sm:size-64"
          >
            <div className="border-nil/[0.07] absolute inset-5 rounded-full border" />
            <span className="bg-taj/50 absolute top-0 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            <span className="bg-nil/40 absolute bottom-0 left-1/2 size-1 -translate-x-1/2 translate-y-1/2 rounded-full" />
          </div>
          <div
            role="region"
            aria-label={t('wordLabel')}
            tabIndex={0}
            className="relative w-full overflow-x-auto overflow-y-hidden rounded-xl py-2"
          >
            <ArabicText
              size="display"
              as="p"
              className="text-subh mx-auto block w-max px-2 text-[clamp(3rem,7vw,5.25rem)] leading-[2]"
            >
              {item.arabic}
            </ArabicText>
          </div>
          <div className="border-hairline/80 bg-kagoj/65 relative flex items-center justify-center gap-3 rounded-full border py-1 ps-5 pe-1">
            <span lang="en" className="font-latin text-dawat text-base">
              {item.transliteration}
            </span>
            <AudioButton
              path={item.audioPath}
              label={t('playAudio')}
              missingLabel={t('audioMissing')}
              className="border-nil/25 bg-nil-wash/60 hover:border-nil/60 size-11 rounded-full"
            />
          </div>
        </div>

        {/* The answer is announced when it appears, so a screen-reader user
            hears the meaning rather than having to hunt for it. */}
        <div
          aria-live="polite"
          className="border-hairline/80 bg-kagoj/45 flex min-h-24 flex-col items-center justify-center gap-2 border-t px-5 py-4 sm:px-8"
        >
          {revealed ? (
            <>
              <span className="text-taj text-xs font-semibold">{t('meaningLabel')}</span>
              <GlossText as="p" script="bn" className="text-dawat block text-xl font-semibold">
                {item.bengaliMeanings.join(', ')}
              </GlossText>
              <GlossText as="p" script="en" className="text-pathor block text-base">
                {item.englishMeanings.join(', ')}
              </GlossText>
            </>
          ) : (
            <p className="text-pathor max-w-sm text-sm leading-relaxed">{t('recallHint')}</p>
          )}
        </div>
      </div>

      <div className="pb-safe mt-5 shrink-0 space-y-3">
        {revealed ? (
          <>
            <p className="text-dawat text-center text-sm font-semibold">{t('gradePrompt')}</p>
            {showSwipeHint ? (
              <p className="text-pathor-soft text-center text-xs md:hidden">{t('swipeHint')}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {GRADES.map((grade) => (
                <GradeButton
                  key={grade}
                  grade={grade}
                  days={item.intervals[grade]}
                  onClick={() => {
                    onGrade(grade);
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onReveal}
            className="border-taj bg-taj text-layl-deep hover:border-taj min-h-16 rounded-2xl hover:bg-[#ffda7a]"
          >
            {t('reveal')}
            {/* Shortcut hints are desktop-only, and CSS decides — rendering
                them conditionally in JS would mean a hydration mismatch. */}
            <span className="font-latin border-layl-deep/20 ms-3 hidden rounded-md border px-2 py-0.5 text-xs font-normal lg:inline">
              {t('spaceKey')}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Each grade keeps its label, interval and keyboard number, so colour is never
 * the only way to distinguish the choices.
 */
function GradeButton({
  grade,
  days,
  onClick,
}: {
  grade: Grade;
  days: number;
  onClick: () => void;
}): ReactNode {
  const t = useTranslations('review');

  const style: Record<Grade, string> = {
    1: 'border-shingraf/35 bg-layl-deep text-shingraf hover:border-shingraf hover:bg-shingraf-wash',
    2: 'border-hairline bg-layl-deep text-dawat hover:border-pathor hover:bg-nil-wash',
    3: 'border-nil/70 bg-nil-wash text-nil-deep hover:border-nil hover:bg-nil-wash/70',
    4: 'border-taj/30 bg-layl-deep text-taj hover:border-taj hover:bg-taj/10',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts={String(grade)}
      className={cn(
        'relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3',
        'transition-colors duration-150',
        style[grade],
      )}
    >
      <span className="text-sm font-semibold">{t(`grade.${grade}`)}</span>
      <span className="text-2xs opacity-80" data-numeric>
        {days === 0 ? t('againSoon') : t('inDays', { days })}
      </span>
      <span
        className="font-latin absolute top-2 right-2 hidden text-[0.65rem] opacity-60 lg:inline"
        aria-hidden="true"
      >
        {grade}
      </span>
    </button>
  );
}
