'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { GlossText } from '@/components/text/GlossText';
import { AudioButton } from '@/components/words/AudioButton';
import { Button } from '@/components/ui/Button';
import { GameShell, useGameClock, type Phase } from './GameShell';
import { shuffle } from '@/lib/games/distractors';
import { scoreRound } from '@/lib/games/scoring';
import {
  checkHarakat,
  gradeHarakat,
  harakatSlots,
  isPlayable,
  type HarakatSlot,
} from '@/lib/games/harakat';
import { gameRunner } from '@/lib/games/runner';
import type { QueueResponseItem } from '@/lib/review/server';

const DURATION = 90;

const FATHA = '\u064E';
const KASRA = '\u0650';
const DAMMA = '\u064F';
const SUKUN = '\u0652';
const SHADDA = '\u0651';

const MARKS = [
  { mark: FATHA, key: 'fatha' },
  { mark: KASRA, key: 'kasra' },
  { mark: DAMMA, key: 'damma' },
  { mark: SUKUN, key: 'sukun' },
  { mark: SHADDA, key: 'shadda' },
] as const;

/**
 * The word appears stripped of its vowels; the learner puts them back.
 *
 * This is the exercise that separates reading Arabic from recognising shapes —
 * ذَهَبَ (he went) and ذَهَب (gold) are the same four letters — and it is the
 * one place in the app where the vowel marks are the content rather than the
 * typography.
 *
 * Selection is per letter and explicit: tap a letter, tap a mark. Nothing is
 * marked right or wrong until the learner says they are done, so they can work
 * back and forth across the word the way they would on paper.
 */
export function Harakat({ signedIn, deckId }: { signedIn: boolean; deckId?: string }): ReactNode {
  const t = useTranslations('games');
  const tGame = useTranslations('games.harakatGame');

  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<QueueResponseItem[]>([]);
  const [current, setCurrent] = useState<QueueResponseItem | null>(null);
  const [slots, setSlots] = useState<HarakatSlot[]>([]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [score, setScore] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const clock = useGameClock(DURATION);
  const runner = useMemo(() => gameRunner('harakat', signedIn), [signedIn]);

  const order = useRef<QueueResponseItem[]>([]);
  const cursor = useRef(0);
  const mistakes = useRef(0);
  const shownAt = useRef(Date.now());
  const startedAt = useRef(new Date());
  const played = useRef(new Set<string>());

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const words = await runner.loadWords(deckId);
      // A word with no vowels to restore has no puzzle in it.
      const playable = words.filter((word) => isPlayable(word.arabic));
      setPool(playable);
      setPhase(playable.length === 0 ? 'empty' : 'intro');
    } catch {
      setPhase('error');
    }
  }, [deckId, runner]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextWord = useCallback(() => {
    if (order.current.length === 0) return;
    const word = order.current[cursor.current % order.current.length]!;
    cursor.current += 1;
    const next = harakatSlots(word.arabic);
    setCurrent(word);
    setSlots(next);
    setPlaced(next.map(() => ''));
    setActive(0);
    setWrong([]);
    setSolved(false);
    mistakes.current = 0;
    shownAt.current = Date.now();
  }, []);

  const start = useCallback(() => {
    setScore(0);
    setTally({ correct: 0, total: 0 });
    played.current = new Set();
    startedAt.current = new Date();
    order.current = shuffle(pool);
    cursor.current = 0;
    nextWord();
    clock.start();
    setPhase('playing');
  }, [clock, nextWord, pool]);

  const end = useCallback(() => {
    const durationMs = clock.stop();
    setPhase('over');
    void runner.finish({
      score,
      durationMs,
      correctCount: tally.correct,
      totalCount: tally.total,
      wordIds: [...played.current],
      startedAt: startedAt.current,
      deckId: deckId ?? null,
    });
  }, [clock, deckId, runner, score, tally]);

  useEffect(() => {
    if (phase === 'playing' && clock.secondsLeft === 0) end();
  }, [clock.secondsLeft, end, phase]);

  const place = useCallback(
    (mark: string) => {
      if (solved) return;
      setWrong([]);
      setPlaced((previous) => {
        const next = [...previous];
        const existing = next[active] ?? '';
        // Tapping the same mark twice clears it — an undo that needs no button.
        if (existing === mark) {
          next[active] = '';
          return next;
        }
        // Shadda stacks with a vowel; a vowel replaces whatever vowel was there.
        next[active] =
          mark === SHADDA
            ? existing.includes(SHADDA)
              ? existing.replace(SHADDA, '')
              : SHADDA + existing
            : (existing.includes(SHADDA) ? SHADDA : '') + mark;
        return next;
      });

      // A vowel finishes a letter, so move along. Shadda does not.
      if (mark !== SHADDA) setActive((index) => Math.min(index + 1, slots.length - 1));
    },
    [active, slots.length, solved],
  );

  const submit = useCallback(() => {
    if (phase !== 'playing' || !current || solved) return;

    const result = checkHarakat(placed, slots);
    if (!result.correct) {
      mistakes.current += 1;
      setWrong(result.wrong);
      // The wrong letters are cleared so the learner re-decides them, and the
      // ones they had right are left alone.
      setPlaced((previous) =>
        previous.map((value, index) => (result.wrong.includes(index) ? '' : value)),
      );
      setActive(result.wrong[0] ?? 0);
      return;
    }

    const elapsedMs = Date.now() - shownAt.current;
    const missed = mistakes.current;
    setSolved(true);
    setScore((previous) => previous + scoreRound(missed, elapsedMs));
    setTally((previous) => ({
      correct: previous.correct + (missed === 0 ? 1 : 0),
      total: previous.total + 1,
    }));
    played.current.add(current.wordId);

    runner.gradeWord({
      wordId: current.wordId,
      deckId: current.deckId ?? deckId ?? null,
      grade: gradeHarakat(missed),
      elapsedMs: Math.min(elapsedMs, 600_000),
    });

    setTimeout(() => {
      nextWord();
    }, 700);
  }, [current, deckId, nextWord, phase, placed, runner, slots, solved]);

  return (
    <GameShell
      title={t('harakat')}
      howTo={tGame('howTo')}
      phase={phase}
      secondsLeft={clock.secondsLeft}
      duration={DURATION}
      score={score}
      onStart={start}
      onRetry={() => void load()}
      summary={tally}
    >
      {current ? (
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <GlossText script="bn" className="text-dawat text-lg">
                {current.bengaliMeanings.join(', ')}
              </GlossText>
              <AudioButton
                path={current.audioPath}
                label={t('playAudio')}
                missingLabel={t('audioMissing')}
              />
            </div>

            {/* The word, letter by letter, right to left. Each letter is its own
                control so a screen reader can say which one is selected. */}
            <div
              dir="rtl"
              lang="ar"
              role="group"
              aria-label={tGame('wordLabel')}
              className="rounded-ui border-hairline bg-chuna flex flex-wrap justify-center gap-1.5 border p-4"
            >
              {slots.map((slot, index) => (
                <button
                  key={`${slot.letter}-${index}`}
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setWrong([]);
                  }}
                  aria-pressed={active === index}
                  aria-label={tGame('letterAt', { position: index + 1 })}
                  className={cn(
                    'min-h-touch rounded-ui flex min-w-11 items-center justify-center border-2 px-2',
                    'font-arabic text-ar-base leading-[2.2]',
                    wrong.includes(index)
                      ? 'border-shingraf bg-shingraf-wash'
                      : solved
                        ? 'border-nil bg-nil-wash'
                        : active === index
                          ? 'border-nil bg-nil-wash/50'
                          : 'bg-kagoj border-transparent',
                  )}
                >
                  {slot.letter}
                  <span className={placed[index] ? 'text-shingraf' : undefined}>
                    {placed[index] ?? ''}
                  </span>
                </button>
              ))}
            </div>

            <p aria-live="polite" className="min-h-6 text-center text-sm">
              {solved ? (
                <span className="text-nil">{tGame('correct')}</span>
              ) : wrong.length > 0 ? (
                <span className="text-shingraf">
                  {tGame('wrongCount', { count: wrong.length })}
                </span>
              ) : (
                <span className="text-pathor-soft">{tGame('hint')}</span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-1.5">
              {MARKS.map(({ mark, key }) => (
                <button
                  key={key}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    place(mark);
                  }}
                  aria-label={tGame(`marks.${key}`)}
                  className={cn(
                    'rounded-ui flex min-h-14 flex-col items-center justify-center gap-0.5 border',
                    'border-hairline bg-chuna active:bg-shingraf-wash transition-colors duration-100',
                    (placed[active] ?? '').includes(mark) && 'border-shingraf bg-shingraf-wash',
                  )}
                >
                  <span className="font-arabic text-shingraf text-xl leading-none">
                    {`\u25CC${mark}`}
                  </span>
                  <span className="text-2xs text-pathor">{tGame(`marks.${key}`)}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  // "No mark" is a real answer, not an omission.
                  setPlaced((previous) => {
                    const next = [...previous];
                    next[active] = '';
                    return next;
                  });
                  setActive((index) => Math.min(index + 1, slots.length - 1));
                }}
                className="rounded-ui border-hairline bg-kagoj text-pathor min-h-14 border text-sm"
              >
                {tGame('noMark')}
              </button>
              {/* Always available: leaving a letter bare is a real answer, so
                  there is no state in which checking would be premature. */}
              <Button variant="primary" size="lg" onClick={submit} disabled={solved}>
                {tGame('check')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
