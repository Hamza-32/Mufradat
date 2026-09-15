import { describe, expect, it } from 'vitest';
import { computeStreak, pickCard, type CardState } from './merge';

const card = (over: Partial<CardState> = {}): CardState => ({
  lastReview: null,
  reps: 0,
  stability: 0,
  ...over,
});

describe('pickCard', () => {
  it('takes the guest card when the account has never seen the word', () => {
    expect(pickCard(null, card({ reps: 3 }))).toBe('incoming');
  });

  it('prefers the card reviewed most recently', () => {
    const existing = card({ lastReview: new Date('2026-09-01T10:00:00Z'), reps: 9 });
    const incoming = card({ lastReview: new Date('2026-09-05T10:00:00Z'), reps: 2 });
    expect(pickCard(existing, incoming)).toBe('incoming');
  });

  it('keeps the account card when it is the more recent one', () => {
    const existing = card({ lastReview: new Date('2026-09-09T10:00:00Z'), reps: 1 });
    const incoming = card({ lastReview: new Date('2026-09-02T10:00:00Z'), reps: 40 });
    expect(pickCard(existing, incoming)).toBe('existing');
  });

  it('falls back to repetitions when neither has been reviewed', () => {
    expect(pickCard(card({ reps: 1 }), card({ reps: 4 }))).toBe('incoming');
  });

  it('falls back to stability when repetitions tie', () => {
    const at = new Date('2026-09-05T10:00:00Z');
    expect(
      pickCard(
        card({ lastReview: at, reps: 3, stability: 4 }),
        card({ lastReview: at, reps: 3, stability: 9 }),
      ),
    ).toBe('incoming');
  });

  it('is a no-op when the two are identical', () => {
    const at = new Date('2026-09-05T10:00:00Z');
    const same = card({ lastReview: at, reps: 3, stability: 4 });
    expect(pickCard(same, { ...same })).toBe('existing');
  });
});

describe('computeStreak', () => {
  it('counts consecutive days up to today', () => {
    const result = computeStreak(['2026-09-09', '2026-09-10', '2026-09-11'], '2026-09-11');
    expect(result).toEqual({ current: 3, longest: 3, lastActiveDate: '2026-09-11' });
  });

  it('keeps the streak alive on the day after the last session', () => {
    expect(computeStreak(['2026-09-09', '2026-09-10'], '2026-09-11').current).toBe(2);
  });

  it('breaks the streak after a missed day', () => {
    const result = computeStreak(['2026-09-01', '2026-09-02'], '2026-09-11');
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it('remembers the longest run even when the current one is broken', () => {
    const result = computeStreak(
      ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-09-11'],
      '2026-09-11',
    );
    expect(result.longest).toBe(4);
    expect(result.current).toBe(1);
  });

  it('ignores duplicates and unsorted input', () => {
    const result = computeStreak(['2026-09-11', '2026-09-10', '2026-09-11'], '2026-09-11');
    expect(result.current).toBe(2);
  });

  it('handles a learner with no activity at all', () => {
    expect(computeStreak([], '2026-09-11')).toEqual({
      current: 0,
      longest: 0,
      lastActiveDate: null,
    });
  });
});
