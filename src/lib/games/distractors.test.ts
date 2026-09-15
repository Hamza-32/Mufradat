import { describe, expect, it } from 'vitest';
import { pickDistractors, shuffle, type DistractorCandidate } from './distractors';
import { gradeFromMistakes, scoreRound } from './scoring';

/** Deterministic "random": always takes the first candidate. */
const stable = () => 0;

const word = (
  wordId: string,
  rootKey: string | null = null,
  tags: string[] = [],
): DistractorCandidate => ({ wordId, rootKey, tags });

describe('pickDistractors', () => {
  const pool = [
    word('kitab', 'كتب', ['learning']),
    word('kataba', 'كتب', ['verbs']),
    word('maktab', 'كتب', ['places']),
    word('khubz', 'خبز', ['food']),
    word('laban', 'لبن', ['food']),
    word('samaa', 'سمو', ['nature']),
  ];

  it('prefers words on the same root', () => {
    const chosen = pickDistractors(pool[0]!, pool, 2, stable);
    expect(chosen).toHaveLength(2);
    expect(chosen.every((id) => ['kataba', 'maktab'].includes(id))).toBe(true);
  });

  it('falls back to the same semantic tag when the root is exhausted', () => {
    const chosen = pickDistractors(word('khubz', 'خبز', ['food']), pool, 1, stable);
    expect(chosen).toEqual(['laban']);
  });

  it('fills from anywhere rather than leaving a question short', () => {
    const chosen = pickDistractors(word('samaa', 'سمو', ['nature']), pool, 3, stable);
    expect(chosen).toHaveLength(3);
  });

  it('never offers the target as its own distractor', () => {
    const chosen = pickDistractors(pool[0]!, pool, 5, stable);
    expect(chosen).not.toContain('kitab');
  });

  it('never repeats a distractor', () => {
    const chosen = pickDistractors(pool[0]!, pool, 5, stable);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it('returns fewer than asked rather than padding when the pool is tiny', () => {
    expect(pickDistractors(pool[0]!, [pool[0]!, pool[1]!], 3, stable)).toEqual(['kataba']);
  });
});

describe('shuffle', () => {
  it('keeps every item', () => {
    const shuffled = shuffle([1, 2, 3, 4, 5], () => 0.42);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('grading a game answer', () => {
  it('treats a clean answer as good, never as easy', () => {
    expect(gradeFromMistakes(0)).toBe(3);
  });

  it('treats one slip as hard', () => {
    expect(gradeFromMistakes(1)).toBe(2);
  });

  it('treats repeated misses as not recalled', () => {
    expect(gradeFromMistakes(2)).toBe(1);
    expect(gradeFromMistakes(7)).toBe(1);
  });
});

describe('scoreRound', () => {
  it('rewards a fast clean answer more than a slow one', () => {
    expect(scoreRound(0, 1000)).toBeGreaterThan(scoreRound(0, 7000));
  });

  it('gives no speed bonus once a mistake has been made', () => {
    expect(scoreRound(1, 100)).toBe(scoreRound(1, 7000));
  });

  it('never returns a negative score', () => {
    expect(scoreRound(5, 600_000)).toBeGreaterThan(0);
  });
});
