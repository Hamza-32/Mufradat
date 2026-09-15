import { describe, expect, it } from 'vitest';
import { buildQueue, reinsert, type QueueCandidate } from './queue-core';
import { newCard } from './scheduler';

const NOW = new Date('2026-09-11T09:00:00Z');

const dueCard = (minutesAgo: number) => ({
  ...newCard(NOW),
  state: 'review' as const,
  due: new Date(NOW.getTime() - minutesAgo * 60_000),
});

const candidate = (over: Partial<QueueCandidate> & { wordId: string }): QueueCandidate => ({
  deckId: 'deck',
  card: null,
  frequencyRank: null,
  deckOrder: 0,
  ...over,
});

describe('buildQueue', () => {
  it('puts the most overdue card first', () => {
    const queue = buildQueue(
      [
        candidate({ wordId: 'b', card: dueCard(5) }),
        candidate({ wordId: 'a', card: dueCard(120) }),
      ],
      { newRemaining: 0, reviewRemaining: 10 },
      NOW,
    );
    expect(queue.map((item) => item.wordId)).toEqual(['a', 'b']);
  });

  it('leaves out cards that are not due yet', () => {
    const future = { ...newCard(NOW), due: new Date(NOW.getTime() + 86_400_000) };
    const queue = buildQueue(
      [candidate({ wordId: 'later', card: future })],
      { newRemaining: 5, reviewRemaining: 10 },
      NOW,
    );
    expect(queue).toHaveLength(0);
  });

  it('introduces new words in deck order, then by frequency', () => {
    const queue = buildQueue(
      [
        candidate({ wordId: 'third', deckOrder: 2 }),
        candidate({ wordId: 'first', deckOrder: 0 }),
        candidate({ wordId: 'second', deckOrder: 1 }),
      ],
      { newRemaining: 3, reviewRemaining: 0 },
      NOW,
    );
    expect(queue.map((item) => item.wordId)).toEqual(['first', 'second', 'third']);
  });

  it('respects both daily caps independently', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) =>
        candidate({ wordId: `due${i}`, card: dueCard(i + 1) }),
      ),
      ...Array.from({ length: 10 }, (_, i) => candidate({ wordId: `new${i}`, deckOrder: i })),
    ];
    const queue = buildQueue(candidates, { newRemaining: 2, reviewRemaining: 3 }, NOW);
    expect(queue.filter((item) => item.isNew)).toHaveLength(2);
    expect(queue.filter((item) => !item.isNew)).toHaveLength(3);
  });

  it('sprinkles new words through the session instead of stacking them', () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) =>
        candidate({ wordId: `due${i}`, card: dueCard(20 - i) }),
      ),
      ...Array.from({ length: 2 }, (_, i) => candidate({ wordId: `new${i}`, deckOrder: i })),
    ];
    const queue = buildQueue(candidates, { newRemaining: 2, reviewRemaining: 8 }, NOW);
    const positions = queue.flatMap((item, index) => (item.isNew ? [index] : []));
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions[0]).not.toBe(positions[1]! - 1);
  });

  it('returns an empty queue when nothing is due and no new words are allowed', () => {
    expect(buildQueue([], { newRemaining: 10, reviewRemaining: 10 }, NOW)).toEqual([]);
  });

  it('treats a negative allowance as zero rather than slicing from the end', () => {
    const queue = buildQueue(
      [candidate({ wordId: 'a', card: dueCard(5) })],
      { newRemaining: -5, reviewRemaining: -5 },
      NOW,
    );
    expect(queue).toEqual([]);
  });
});

describe('reinsert', () => {
  it('brings a failed card back later in the same session', () => {
    expect(reinsert(['b', 'c', 'd', 'e'], 'a', 3)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });

  it('puts it at the end when the session is nearly over', () => {
    expect(reinsert(['b'], 'a', 3)).toEqual(['b', 'a']);
  });
});
