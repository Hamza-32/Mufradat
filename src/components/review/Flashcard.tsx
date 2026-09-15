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
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={
          drag === 0 ? undefined : { transform: `translateX(${drag}px) rotate(${tilt * 2}deg)` }
        }
        className={cn(
          'flex min-h-0 flex-1 flex-col items-center justify-center gap-6',
          'rounded-ui border-hairline bg-chuna border px-5 py-8 text-center',
          'touch-pan-y select-none',
          drag === 0 && 'ease-card transition-transform duration-200',
        )}
      >
        <div className="space-y-3">
          <ArabicText size="display" as="p" className="text-nil">
            {item.arabic}
          </ArabicText>
          <div className="flex items-center justify-center gap-3">
            <span className="font-latin text-pathor-soft text-sm">{item.transliteration}</span>
            <AudioButton
              path={item.audioPath}
              label={t('playAudio')}
              missingLabel={t('audioMissing')}
            />
          </div>
        </div>

        <hr className="border-hairline w-24" />

        {/* The answer is announced when it appears, so a screen-reader user
            hears the meaning rather than having to hunt for it. */}
        <div aria-live="polite" className="min-h-24 space-y-2">
          {revealed ? (
            <>
              <GlossText as="p" script="bn" className="text-dawat text-xl">
                {item.bengaliMeanings.join(', ')}
              </GlossText>
              <GlossText as="p" script="en" className="text-pathor text-base">
                {item.englishMeanings.join(', ')}
              </GlossText>
            </>
          ) : null}
        </div>
      </div>

      <div className="pb-safe mt-4 shrink-0 space-y-3">
        {revealed ? (
          <>
            {showSwipeHint ? (
              <p className="text-pathor-soft text-center text-xs md:hidden">{t('swipeHint')}</p>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
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
          <Button variant="primary" size="lg" fullWidth onClick={onReveal}>
            {t('reveal')}
            {/* Shortcut hints are desktop-only, and CSS decides — rendering
                them conditionally in JS would mean a hydration mismatch. */}
            <span className="font-latin ms-2 hidden text-sm font-normal opacity-90 lg:inline">
              {t('spaceKey')}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Four grades, one hue. They are told apart by weight, position, number and
 * label — never by colour alone, which would fail for a colour-blind learner
 * and for anyone reviewing in bright sunlight.
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
    1: 'border-shingraf/50 text-shingraf hover:bg-shingraf-wash',
    2: 'border-hairline text-pathor hover:bg-nil-wash',
    3: 'border-nil bg-nil text-chuna hover:bg-nil-deep',
    4: 'border-nil bg-nil-wash text-nil hover:bg-nil-wash/70',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts={String(grade)}
      className={cn(
        'rounded-ui flex min-h-16 flex-col items-center justify-center gap-0.5 border px-1',
        'transition-colors duration-150',
        style[grade],
      )}
    >
      <span className="text-sm font-semibold">{t(`grade.${grade}`)}</span>
      <span className="text-2xs opacity-80" data-numeric>
        {days === 0 ? t('againSoon') : t('inDays', { days })}
      </span>
      <span className="font-latin text-2xs hidden opacity-80 lg:inline" aria-hidden="true">
        {grade}
      </span>
    </button>
  );
}
