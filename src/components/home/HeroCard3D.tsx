'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';

/**
 * The landing page's one piece of dimension: a flashcard that actually turns in
 * space, sitting on the deck it was drawn from.
 *
 * Built from CSS transforms rather than a 3D library on purpose. This app is
 * for a mid-range phone on patchy data, and a WebGL runtime would cost more
 * bytes than every font in the repo put together. `preserve-3d` and `rotateY`
 * are composited on the GPU and cost nothing to download.
 *
 * The card shows what the product is before a word of marketing copy: Arabic on
 * the front, the Bengali on the back, the turn in between.
 */

export interface HeroWord {
  arabic: string;
  transliteration: string;
  bengali: string;
  english: string;
}

/** How long each face is held before the card turns itself. */
const DWELL_MS = 3800;

export function HeroCard3D({
  words,
  hint,
  tone = 'paper',
  className,
}: {
  words: readonly HeroWord[];
  /** Screen-reader and caption text: what pressing the card does. */
  hint: string;
  /** `dark` is the signed-out landing, which sits on navy rather than paper. */
  tone?: 'paper' | 'dark';
  className?: string;
}): ReactNode {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [still, setStill] = useState(false);
  const frame = useRef<HTMLDivElement | null>(null);

  // A learner who has asked for less motion gets a card that only turns when
  // they press it. Everything else here is a transition, which the global
  // reduced-motion rule already flattens.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = (): void => {
      setStill(query.matches);
    };
    sync();
    query.addEventListener('change', sync);
    return () => {
      query.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => {
      setFlipped((was) => {
        // Advance to the next word only once the card is face-down again, so a
        // word is never swapped out while the learner is reading it.
        if (was) setIndex((i) => (i + 1) % words.length);
        return !was;
      });
    }, DWELL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [still, words.length]);

  // Pointer parallax: the card leans towards the cursor. Touch is left alone —
  // a thumb is already on the card, and the lean would fight the scroll.
  const lean = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const node = frame.current;
    if (!node || event.pointerType !== 'mouse') return;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty('--lean-y', `${(x * 16).toFixed(2)}deg`);
    node.style.setProperty('--lean-x', `${(-y * 12).toFixed(2)}deg`);
  }, []);

  const level = useCallback(() => {
    const node = frame.current;
    if (!node) return;
    node.style.setProperty('--lean-y', '-12deg');
    node.style.setProperty('--lean-x', '6deg');
  }, []);

  const word = words[index] ?? words[0];
  const dark = tone === 'dark';
  if (!word) return null;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        ref={frame}
        onPointerMove={lean}
        onPointerLeave={level}
        className="relative [perspective:1400px]"
        // A resting tilt, so the card reads as an object in space before anyone
        // touches it. The pointer takes over from here and `level()` returns to
        // these values, not to flat.
        style={{ ['--lean-x' as string]: '6deg', ['--lean-y' as string]: '-12deg' }}
      >
        {/* The deck the card came off. Two hairline slabs pushed back in Z, so
            the stack reads as depth rather than as a drop shadow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [transform-style:preserve-3d]"
          style={{ transform: 'rotateX(var(--lean-x)) rotateY(var(--lean-y))' }}
        >
          <div
            className={cn(
              'rounded-sheet absolute inset-0 border',
              dark ? 'border-layl-line bg-layl-soft/70' : 'border-hairline bg-chuna/70',
            )}
            style={{ transform: 'translateZ(-38px) translateY(14px) scale(0.965)' }}
          />
          <div
            className={cn(
              'rounded-sheet absolute inset-0 border',
              dark ? 'border-layl-line/60 bg-layl-soft/40' : 'border-hairline-soft bg-chuna/45',
            )}
            style={{ transform: 'translateZ(-72px) translateY(28px) scale(0.93)' }}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setFlipped((was) => !was);
          }}
          aria-label={hint}
          className={cn(
            'rounded-sheet relative block size-[17rem] sm:size-[20rem]',
            'transition-transform duration-700 [transform-style:preserve-3d]',
            'focus-visible:outline-2 focus-visible:outline-offset-4',
            dark ? 'focus-visible:outline-nahar-blue' : 'focus-visible:outline-nil',
          )}
          style={{
            transform: `rotateX(var(--lean-x)) rotateY(calc(var(--lean-y) + ${flipped ? 180 : 0}deg))`,
            transitionTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          }}
        >
          <Face dark={dark}>
            <ArabicText size="display" className={dark ? 'text-taj' : 'text-nil'}>
              {word.arabic}
            </ArabicText>
            <span
              className={cn('font-latin text-sm', dark ? 'text-subh-soft' : 'text-pathor-soft')}
            >
              {word.transliteration}
            </span>
          </Face>

          <Face back dark={dark}>
            <GlossText
              script="bn"
              className={cn('text-xl font-semibold', dark ? 'text-subh' : 'text-dawat')}
            >
              {word.bengali}
            </GlossText>
            <span className={cn('font-latin text-sm', dark ? 'text-subh-soft' : 'text-pathor')}>
              {word.english}
            </span>
          </Face>
        </button>
      </div>

      {/* The dots are the deck, not a carousel control: they say how many words
          are cycling, and which one is up. */}
      <ul className="flex items-center gap-1.5" aria-hidden>
        {words.map((entry, i) => (
          <li
            key={entry.arabic}
            className={cn(
              'rounded-data h-1 transition-all duration-500',
              i === index
                ? dark
                  ? 'bg-taj w-5'
                  : 'bg-nil w-5'
                : dark
                  ? 'bg-layl-line w-1.5'
                  : 'bg-hairline w-1.5',
            )}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * One side of the card. Both faces are stacked in the same grid cell; the back
 * is pre-turned so that it lands upright when the card does.
 */
function Face({
  children,
  back = false,
  dark = false,
}: {
  children: ReactNode;
  back?: boolean;
  dark?: boolean;
}): ReactNode {
  return (
    <div
      className={cn(
        'rounded-sheet absolute inset-0 flex flex-col items-center justify-center gap-3 border',
        'shadow-float [backface-visibility:hidden]',
        dark ? 'border-layl-line bg-layl-deep' : 'border-hairline bg-chuna',
        back && (dark ? 'bg-layl-soft' : 'bg-nil-wash/50'),
      )}
      style={back ? { transform: 'rotateY(180deg)' } : undefined}
    >
      {children}
    </div>
  );
}
