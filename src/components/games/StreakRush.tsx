'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { GameShell, useGameClock, type Phase } from './GameShell';
import { buildChoiceQuestion, type ChoiceQuestion } from '@/lib/games/choice';
import { shuffle } from '@/lib/games/distractors';
import { gameRunner } from '@/lib/games/runner';
import type { QueueResponseItem } from '@/lib/review/server';

const DURATION = 60;
const OPTIONS = 3;

/**
 * Sixty seconds, three options, no second chances.
 *
 * The other games let a wrong answer be corrected; this one does not, and that
 * is the whole point of it — it measures what the learner knows *without*
 * working it out, which is the state Quranic reading actually demands.
 *
 * The direction alternates: Arabic to Bengali, then Bengali to Arabic. Recall
 * in one direction is not recall in the other, and a game short enough to play
 * twice should not drill only half of it.
 */
export function StreakRush({
  signedIn,
  deckId,
}: {
  signedIn: boolean;
  deckId?: string;
}): ReactNode {
  const t = useTranslations('games');
  const tGame = useTranslations('games.streakRushGame');

  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<QueueResponseItem[]>([]);
  const [question, setQuestion] = useState<ChoiceQuestion | null>(null);
  const [toArabic, setToArabic] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const clock = useGameClock(DURATION);
  const runner = useMemo(() => gameRunner('streak_rush', signedIn), [signedIn]);

  const order = useRef<QueueResponseItem[]>([]);
  const cursor = useRef(0);
  const shownAt = useRef(Date.now());
  const startedAt = useRef(new Date());
  const played = useRef(new Set<string>());

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const words = await runner.loadWords(deckId);
      setPool(words);
      setPhase(words.length < OPTIONS ? 'empty' : 'intro');
    } catch {
      setPhase('error');
    }
  }, [deckId, runner]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextQuestion = useCallback(() => {
    if (order.current.length === 0) return;
    const target = order.current[cursor.current % order.current.length]!;
    setToArabic(cursor.current % 2 === 1);
    cursor.current += 1;
    setQuestion(buildChoiceQuestion(target, pool, OPTIONS));
    setChosen(null);
    shownAt.current = Date.now();
  }, [pool]);

  const start = useCallback(() => {
    setScore(0);
    setStreak(0);
    setBest(0);
    setTally({ correct: 0, total: 0 });
    played.current = new Set();
    startedAt.current = new Date();
    order.current = shuffle(pool);
    cursor.current = 0;
    nextQuestion();
    clock.start();
    setPhase('playing');
  }, [clock, nextQuestion, pool]);

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

  const answer = useCallback(
    (wordId: string) => {
      if (phase !== 'playing' || !question || chosen !== null) return;
      setChosen(wordId);

      const right = wordId === question.target.wordId;
      const elapsedMs = Date.now() - shownAt.current;
      played.current.add(question.target.wordId);

      setTally((previous) => ({
        correct: previous.correct + (right ? 1 : 0),
        total: previous.total + 1,
      }));

      if (right) {
        // The streak is the score: each answer is worth more than the last, so
        // a run of six feels like a run of six rather than six ones.
        setStreak((previous) => {
          const next = previous + 1;
          setBest((highest) => Math.max(highest, next));
          setScore((points) => points + 10 * Math.min(next, 10));
          return next;
        });
      } else {
        setStreak(0);
      }

      runner.gradeWord({
        wordId: question.target.wordId,
        deckId: question.target.deckId ?? deckId ?? null,
        // No second chances, so the grade is binary: recalled or not.
        grade: right ? 3 : 1,
        elapsedMs: Math.min(elapsedMs, 600_000),
      });

      setTimeout(
        () => {
          nextQuestion();
        },
        right ? 280 : 700,
      );
    },
    [chosen, deckId, nextQuestion, phase, question, runner],
  );

  useEffect(() => {
    if (phase !== 'playing' || !question) return;
    function onKeyDown(event: KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (Number.isNaN(index) || index < 0 || index >= question!.options.length) return;
      event.preventDefault();
      answer(question!.options[index]!.wordId);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [answer, phase, question]);

  return (
    <GameShell
      title={t('streakRush')}
      howTo={tGame('howTo')}
      phase={phase}
      secondsLeft={clock.secondsLeft}
      duration={DURATION}
      score={score}
      onStart={start}
      onRetry={() => void load()}
      summary={tally}
    >
      {question ? (
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-5">
          <p
            aria-live="polite"
            className={cn(
              'text-center text-sm',
              streak >= 3 ? 'text-shingraf font-semibold' : 'text-pathor',
            )}
            data-numeric
          >
            {streak === 0
              ? tGame('bestStreak', { count: best })
              : tGame('streak', { count: streak })}
          </p>

          <div className="rounded-ui border-hairline bg-chuna flex flex-1 items-center justify-center border p-6 text-center">
            {toArabic ? (
              <GlossText script="bn" className="text-dawat text-2xl">
                {question.target.bengaliMeanings[0] ?? ''}
              </GlossText>
            ) : (
              <ArabicText size="display" as="p" className="text-nil">
                {question.target.arabic}
              </ArabicText>
            )}
          </div>

          <ul className="grid gap-2" aria-label={tGame('optionsLabel')}>
            {question.options.map((option, index) => {
              const isTarget = option.wordId === question.target.wordId;
              const isChosen = chosen === option.wordId;
              const revealed = chosen !== null;

              return (
                <li key={option.wordId}>
                  <button
                    type="button"
                    onClick={() => {
                      answer(option.wordId);
                    }}
                    aria-keyshortcuts={String(index + 1)}
                    className={cn(
                      'rounded-ui flex min-h-14 w-full items-center gap-3 border px-4 py-2 text-start',
                      'transition-colors duration-100',
                      revealed && isTarget
                        ? 'border-nil bg-nil-wash'
                        : isChosen
                          ? 'border-shingraf bg-shingraf-wash'
                          : 'border-hairline bg-chuna hover:border-nil-soft',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="font-latin text-pathor-soft hidden text-xs lg:inline"
                    >
                      {index + 1}
                    </span>
                    {toArabic ? (
                      <ArabicText size="sm" className="text-nil">
                        {option.arabic}
                      </ArabicText>
                    ) : (
                      <GlossText script="bn" className="text-base">
                        {option.bengaliMeanings[0] ?? ''}
                      </GlossText>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </GameShell>
  );
}
