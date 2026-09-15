'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { ArabicText } from '@/components/text/ArabicText';
import { GlossText } from '@/components/text/GlossText';
import { GameShell, useGameClock, type Phase } from './GameShell';
import { shuffle } from '@/lib/games/distractors';
import { gradeFromMistakes, scoreRound } from '@/lib/games/scoring';
import { gameRunner } from '@/lib/games/runner';
import type { QueueResponseItem } from '@/lib/review/server';

const DURATION = 75;

interface Tile {
  id: string;
  wordId: string;
  face: 'arabic' | 'bengali';
  text: string;
}

/**
 * Arabic on one side, Bengali on the other. Four pairs on a phone (a 2×4 grid,
 * every tile inside thumb reach) and six on a wider board, chosen at the start
 * of the round so the layout never changes mid-game.
 *
 * Tiles stay face up throughout. This is not a memory game — hiding the text
 * would test working memory rather than vocabulary, and the point is the words.
 */
export function MatchPairs({
  signedIn,
  deckId,
}: {
  signedIn: boolean;
  deckId?: string;
}): ReactNode {
  const t = useTranslations('games');
  const tMatch = useTranslations('games.matchPairsGame');

  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<QueueResponseItem[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const clock = useGameClock(DURATION);
  const runner = useMemo(() => gameRunner('match_pairs', signedIn), [signedIn]);

  const mistakes = useRef(new Map<string, number>());
  const shownAt = useRef(Date.now());
  const startedAt = useRef(new Date());
  const playedWords = useRef(new Set<string>());

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const words = await runner.loadWords(deckId);
      setPool(words);
      setPhase(words.length < 4 ? 'empty' : 'intro');
    } catch {
      setPhase('error');
    }
  }, [deckId, runner]);

  useEffect(() => {
    void load();
  }, [load]);

  const deal = useCallback(() => {
    // Board size is decided once, from the viewport, before the first tile is
    // drawn — resizing mid-round must not reshuffle the game.
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    const pairs = Math.min(wide ? 6 : 4, pool.length);
    const chosen = shuffle(pool).slice(0, pairs);

    setTiles(
      shuffle(
        chosen.flatMap<Tile>((word) => [
          { id: `${word.wordId}:ar`, wordId: word.wordId, face: 'arabic', text: word.arabic },
          {
            id: `${word.wordId}:bn`,
            wordId: word.wordId,
            face: 'bengali',
            text: word.bengaliMeanings[0] ?? '',
          },
        ]),
      ),
    );
    setMatched(new Set());
    setSelected(null);
    setWrong([]);
    mistakes.current = new Map();
    shownAt.current = Date.now();
  }, [pool]);

  const start = useCallback(() => {
    setScore(0);
    setTally({ correct: 0, total: 0 });
    playedWords.current = new Set();
    startedAt.current = new Date();
    deal();
    clock.start();
    setPhase('playing');
  }, [clock, deal]);

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

  // Time is up: end the round wherever it stands.
  useEffect(() => {
    if (phase === 'playing' && clock.secondsLeft === 0) end();
  }, [clock.secondsLeft, end, phase]);

  const choose = useCallback(
    (tile: Tile) => {
      if (phase !== 'playing' || matched.has(tile.wordId)) return;

      if (!selected) {
        setSelected(tile);
        return;
      }
      if (selected.id === tile.id) {
        setSelected(null);
        return;
      }
      // Two tiles of the same face cannot be a pair; treat it as a re-pick
      // rather than a mistake, since it is a slip of the thumb, not a wrong
      // answer about the word.
      if (selected.face === tile.face) {
        setSelected(tile);
        return;
      }

      if (selected.wordId === tile.wordId) {
        const missed = mistakes.current.get(tile.wordId) ?? 0;
        const elapsedMs = Date.now() - shownAt.current;

        setMatched((previous) => new Set(previous).add(tile.wordId));
        setSelected(null);
        setScore((previous) => previous + scoreRound(missed, elapsedMs));
        setTally((previous) => ({
          correct: previous.correct + (missed === 0 ? 1 : 0),
          total: previous.total + 1,
        }));
        playedWords.current.add(tile.wordId);

        // The match is a review: it goes through the same scheduler a flashcard
        // would, under this game's own source.
        const word = pool.find((item) => item.wordId === tile.wordId);
        runner.gradeWord({
          wordId: tile.wordId,
          deckId: word?.deckId ?? deckId ?? null,
          grade: gradeFromMistakes(missed),
          elapsedMs: Math.min(elapsedMs, 600_000),
        });

        shownAt.current = Date.now();
        return;
      }

      // A genuine mismatch. Both words carry the mistake, because the learner
      // was wrong about both of them.
      for (const id of [selected.wordId, tile.wordId]) {
        mistakes.current.set(id, (mistakes.current.get(id) ?? 0) + 1);
      }
      setWrong([selected.id, tile.id]);
      setSelected(null);
      setTimeout(() => {
        setWrong([]);
      }, 450);
    },
    [deckId, matched, phase, pool, runner, selected],
  );

  // Board cleared with time to spare: deal a fresh one rather than idling.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (tiles.length > 0 && matched.size === tiles.length / 2) {
      const timer = setTimeout(() => {
        deal();
      }, 400);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [deal, matched, phase, tiles.length]);

  return (
    <GameShell
      title={t('matchPairs')}
      howTo={tMatch('howTo')}
      phase={phase}
      secondsLeft={clock.secondsLeft}
      duration={DURATION}
      score={score}
      onStart={start}
      onRetry={() => void load()}
      summary={tally}
    >
      <ul
        // 2×4 on a phone, a wider board above it. Tiles are square-ish so the
        // Arabic never has to shrink to fit.
        className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4"
        aria-label={tMatch('boardLabel')}
      >
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.wordId);
          const isSelected = selected?.id === tile.id;
          const isWrong = wrong.includes(tile.id);

          return (
            <li key={tile.id}>
              <button
                type="button"
                onClick={() => {
                  choose(tile);
                }}
                disabled={isMatched}
                aria-pressed={isSelected}
                className={cn(
                  'rounded-ui flex min-h-20 w-full items-center justify-center border p-2 text-center',
                  'transition-colors duration-150 md:min-h-24',
                  isMatched
                    ? 'border-hairline-soft bg-kagoj text-pathor-soft opacity-60'
                    : isWrong
                      ? 'border-shingraf bg-shingraf-wash'
                      : isSelected
                        ? 'border-nil bg-nil-wash'
                        : 'border-hairline bg-chuna hover:border-nil-soft',
                )}
              >
                {tile.face === 'arabic' ? (
                  <ArabicText size="sm" className={isMatched ? '' : 'text-nil'}>
                    {tile.text}
                  </ArabicText>
                ) : (
                  <GlossText script="bn" className="text-base">
                    {tile.text}
                  </GlossText>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="sr-only">
        {tMatch('matchedCount', { count: matched.size })}
      </p>
    </GameShell>
  );
}
