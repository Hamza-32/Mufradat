'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { GameShell, useGameClock, type Phase } from './GameShell';
import { shuffle } from '@/lib/games/distractors';
import { buildChoiceQuestion, type ChoiceQuestion } from '@/lib/games/choice';
import { gradeFromMistakes, scoreRound } from '@/lib/games/scoring';
import { gameRunner } from '@/lib/games/runner';
import type { QueueResponseItem } from '@/lib/review/server';

const DURATION = 75;
const OPTIONS = 4;

/**
 * Arabic word, four Bengali meanings. The three wrong ones are drawn from the
 * target's own root or semantic tag rather than at random, so the question
 * cannot be answered by elimination — كِتَاب against كَتَبَ and مَكْتَب makes
 * the learner distinguish, "book against market against sky" does not.
 */
export function MultipleChoice({
  signedIn,
  deckId,
}: {
  signedIn: boolean;
  deckId?: string;
}): ReactNode {
  const t = useTranslations('games');
  const tGame = useTranslations('games.multipleChoiceGame');

  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<QueueResponseItem[]>([]);
  const [question, setQuestion] = useState<ChoiceQuestion | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const clock = useGameClock(DURATION);
  const runner = useMemo(() => gameRunner('multiple_choice', signedIn), [signedIn]);

  const order = useRef<QueueResponseItem[]>([]);
  const cursor = useRef(0);
  const mistakes = useRef(0);
  const shownAt = useRef(Date.now());
  const startedAt = useRef(new Date());
  const playedWords = useRef(new Set<string>());

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
    cursor.current += 1;

    setQuestion(buildChoiceQuestion(target, pool, OPTIONS));
    setChosen(null);
    mistakes.current = 0;
    shownAt.current = Date.now();
  }, [pool]);

  const start = useCallback(() => {
    setScore(0);
    setTally({ correct: 0, total: 0 });
    playedWords.current = new Set();
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
      wordIds: [...playedWords.current],
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

      if (wordId !== question.target.wordId) {
        // A wrong tap does not end the question: the learner gets to find the
        // right answer, and the extra mistake is what lowers the grade.
        mistakes.current += 1;
        setTimeout(() => {
          setChosen(null);
        }, 550);
        return;
      }

      const elapsedMs = Date.now() - shownAt.current;
      const missed = mistakes.current;
      setScore((previous) => previous + scoreRound(missed, elapsedMs));
      setTally((previous) => ({
        correct: previous.correct + (missed === 0 ? 1 : 0),
        total: previous.total + 1,
      }));
      playedWords.current.add(question.target.wordId);

      runner.gradeWord({
        wordId: question.target.wordId,
        deckId: question.target.deckId ?? deckId ?? null,
        grade: gradeFromMistakes(missed),
        elapsedMs: Math.min(elapsedMs, 600_000),
      });

      setTimeout(() => {
        nextQuestion();
      }, 400);
    },
    [chosen, deckId, nextQuestion, phase, question, runner],
  );

  // Desktop: 1–4 answer the question, the same keys that grade a flashcard.
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
      title={t('multipleChoice')}
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
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-6">
          <div className="rounded-ui border-hairline bg-chuna flex flex-1 items-center justify-center border p-6 text-center">
            <ArabicText size="display" as="p" className="text-nil">
              {question.target.arabic}
            </ArabicText>
          </div>

          <ul className="grid gap-2 md:grid-cols-2" aria-label={tGame('optionsLabel')}>
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
                      'min-h-touch rounded-ui flex w-full items-center gap-3 border px-4 py-3 text-start',
                      'transition-colors duration-150',
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
                    <GlossText script="bn" className="text-base">
                      {option.bengaliMeanings[0] ?? ''}
                    </GlossText>
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
