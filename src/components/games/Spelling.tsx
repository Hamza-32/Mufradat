'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { AudioButton } from '@/components/words/AudioButton';
import { Button } from '@/components/ui/Button';
import { GameShell, useGameClock, type Phase } from './GameShell';
import { ArabicKeyboard } from './ArabicKeyboard';
import { shuffle } from '@/lib/games/distractors';
import { checkSpelling, gradeSpelling, type SpellingVerdict } from '@/lib/games/spelling';
import { isLatinInput, latinToArabic, TRANSLIT_GUIDE } from '@/lib/games/translit';
import { scoreRound } from '@/lib/games/scoring';
import { gameRunner } from '@/lib/games/runner';
import type { QueueResponseItem } from '@/lib/review/server';

const DURATION = 90;

/**
 * The hardest of the six to get right, because the input method is the game.
 *
 * Phone: a custom Arabic keyboard with the vowel marks on the top row. The
 * system keyboard hides tashkeel behind a long press, which is useless when the
 * vowels are the lesson — and it would also cover half the screen.
 *
 * Desktop: the physical keyboard, with Latin converted to Arabic as the learner
 * types. Almost nobody in Dhaka has an Arabic layout installed, and telling
 * them to install one is telling them not to play.
 */
export function Spelling({ signedIn, deckId }: { signedIn: boolean; deckId?: string }): ReactNode {
  const t = useTranslations('games');
  const tGame = useTranslations('games.spellingGame');

  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<QueueResponseItem[]>([]);
  const [current, setCurrent] = useState<QueueResponseItem | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<SpellingVerdict | null>(null);
  const [score, setScore] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const [showGuide, setShowGuide] = useState(false);

  const clock = useGameClock(DURATION);
  const runner = useMemo(() => gameRunner('spelling', signedIn), [signedIn]);

  const order = useRef<QueueResponseItem[]>([]);
  const cursor = useRef(0);
  const mistakes = useRef(0);
  const shownAt = useRef(Date.now());
  const startedAt = useRef(new Date());
  const played = useRef(new Set<string>());
  const field = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const words = await runner.loadWords(deckId);
      setPool(words);
      setPhase(words.length === 0 ? 'empty' : 'intro');
    } catch {
      setPhase('error');
    }
  }, [deckId, runner]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextWord = useCallback(() => {
    if (order.current.length === 0) return;
    setCurrent(order.current[cursor.current % order.current.length]!);
    cursor.current += 1;
    setTyped('');
    setVerdict(null);
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

  const submit = useCallback(() => {
    if (phase !== 'playing' || !current || verdict !== null) return;

    const result = checkSpelling(typed, current.arabic);
    setVerdict(result);

    if (result === 'wrong') {
      // A wrong attempt does not move on: the learner tries again, and the
      // mistake is what lowers the grade.
      mistakes.current += 1;
      setTimeout(() => {
        setVerdict(null);
      }, 600);
      return;
    }

    const elapsedMs = Date.now() - shownAt.current;
    const missed = mistakes.current;
    setScore(
      (previous) => previous + scoreRound(result === 'exact' ? missed : missed + 1, elapsedMs),
    );
    setTally((previous) => ({
      correct: previous.correct + (result === 'exact' && missed === 0 ? 1 : 0),
      total: previous.total + 1,
    }));
    played.current.add(current.wordId);

    runner.gradeWord({
      wordId: current.wordId,
      deckId: current.deckId ?? deckId ?? null,
      grade: gradeSpelling(result, missed),
      elapsedMs: Math.min(elapsedMs, 600_000),
    });

    // Right letters, missing vowels: hold the vowelled form on screen for a
    // moment, because that is the thing they did not know.
    setTimeout(
      () => {
        nextWord();
      },
      result === 'exact' ? 450 : 1400,
    );
  }, [current, deckId, nextWord, phase, runner, typed, verdict]);

  const insert = useCallback((character: string) => {
    setTyped((previous) => previous + character);
  }, []);

  const backspace = useCallback(() => {
    // Delete by code point, so removing a vowel mark does not eat its letter.
    setTyped((previous) => [...previous].slice(0, -1).join(''));
  }, []);

  return (
    <GameShell
      title={t('spelling')}
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
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* The prompt: meaning and sound, never the Arabic — that is the answer. */}
          <div className="rounded-ui border-hairline bg-chuna flex items-center justify-between gap-3 border p-4">
            <div className="min-w-0">
              <GlossText script="bn" className="text-dawat block text-xl">
                {current.bengaliMeanings.join(', ')}
              </GlossText>
              <GlossText script="en" className="text-pathor block text-sm">
                {current.englishMeanings.join(', ')}
              </GlossText>
            </div>
            <AudioButton
              path={current.audioPath}
              label={t('playAudio')}
              missingLabel={t('audioMissing')}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="spelling-answer" className="sr-only">
              {tGame('inputLabel')}
            </label>
            <input
              id="spelling-answer"
              ref={field}
              value={typed}
              onChange={(event) => {
                const value = event.target.value;
                // Latin in, Arabic out — the helper runs as they type rather
                // than on a button they have to find.
                setTyped(isLatinInput(value) ? latinToArabic(value) : value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              lang="ar"
              dir="rtl"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              // The custom keyboard is the input method on touch; the system one
              // would cover the board and hide the tashkeel row.
              readOnly={false}
              inputMode="none"
              className={cn(
                'rounded-ui bg-chuna font-arabic text-ar-base w-full border-2 px-4 py-3 text-center leading-[2]',
                verdict === 'wrong'
                  ? 'border-shingraf'
                  : verdict === null
                    ? 'border-hairline focus-visible:border-nil'
                    : 'border-nil',
              )}
            />

            <p aria-live="polite" className="min-h-6 text-center text-sm">
              {verdict === 'wrong' ? (
                <span className="text-shingraf">{tGame('tryAgain')}</span>
              ) : verdict === 'letters-only' ? (
                <span className="text-pathor">
                  {tGame('vowelsMissing')}{' '}
                  <ArabicText size="sm" rubricate className="ms-2">
                    {current.arabic}
                  </ArabicText>
                </span>
              ) : verdict === 'exact' ? (
                <span className="text-nil">{tGame('correct')}</span>
              ) : (
                <span className="text-pathor-soft">
                  {tGame('letterCount', {
                    count: [...current.arabic.replace(/[\u064B-\u0652]/gu, '')].length,
                  })}
                </span>
              )}
            </p>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={submit}
              disabled={typed.trim() === '' || verdict !== null}
            >
              {tGame('check')}
            </Button>
          </div>

          {/* Touch: the keyboard. Desktop: the transliteration guide, with the
              keyboard one tap away for the letters the scheme cannot reach. */}
          <div className="lg:hidden">
            <ArabicKeyboard
              onInsert={insert}
              onBackspace={backspace}
              onClear={() => {
                setTyped('');
              }}
            />
          </div>

          <div className="hidden lg:block">
            <button
              type="button"
              aria-expanded={showGuide}
              onClick={() => {
                setShowGuide((value) => !value);
              }}
              className="min-h-touch rounded-ui border-hairline bg-chuna text-pathor hover:text-nil border px-3 text-sm"
            >
              {showGuide ? tGame('hideGuide') : tGame('showGuide')}
            </button>

            {showGuide ? (
              <div className="rounded-ui border-hairline bg-chuna mt-3 space-y-4 border p-4">
                <p className="text-pathor text-sm">{tGame('guideIntro')}</p>
                {TRANSLIT_GUIDE.map((section) => (
                  <dl key={section.label} className="space-y-1">
                    {section.keys.map((row) => (
                      <div key={row.latin} className="flex flex-wrap items-baseline gap-x-3">
                        <dt className="font-latin text-nil text-sm">{row.latin}</dt>
                        <dd className="font-arabic text-lg" lang="ar" dir="rtl">
                          {row.arabic}
                        </dd>
                        {row.hint ? <dd className="text-pathor-soft text-xs">{row.hint}</dd> : null}
                      </div>
                    ))}
                  </dl>
                ))}
                <ArabicKeyboard
                  onInsert={insert}
                  onBackspace={backspace}
                  onClear={() => {
                    setTyped('');
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </GameShell>
  );
}
