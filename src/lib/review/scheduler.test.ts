import { describe, expect, it } from 'vitest';
import { gradeCard, localDateIn, masteryOf, newCard, previewIntervals } from './scheduler';

const NOW = new Date('2026-09-11T09:00:00Z');

describe('newCard', () => {
  it('starts unseen and due immediately', () => {
    const card = newCard(NOW);
    expect(card.state).toBe('new');
    expect(card.reps).toBe(0);
    expect(card.due.getTime()).toBe(NOW.getTime());
    expect(masteryOf(card)).toBe('new');
  });
});

describe('gradeCard', () => {
  it('moves a new card into learning and records what it was before', () => {
    const outcome = gradeCard(newCard(NOW), 3, NOW);
    expect(outcome.card.state).toBe('learning');
    expect(outcome.card.reps).toBe(1);
    expect(outcome.log.stateBefore).toBe('new');
    // A card that was never seen has no prior due date to log.
    expect(outcome.log.dueBefore).toBeNull();
    expect(outcome.log.stabilityBefore).toBeNull();
  });

  it('schedules "easy" further out than "good", and "again" soonest', () => {
    const card = newCard(NOW);
    const intervals = previewIntervals(card, NOW);
    expect(intervals[1]).toBeLessThanOrEqual(intervals[3]);
    expect(intervals[4]).toBeGreaterThanOrEqual(intervals[3]);
  });

  it('counts a lapse when a reviewed card is forgotten', () => {
    let card = newCard(NOW);
    for (const [index, grade] of ([4, 4, 4] as const).entries()) {
      card = gradeCard(card, grade, new Date(NOW.getTime() + index * 86_400_000)).card;
    }
    expect(card.state).toBe('review');

    const lapsed = gradeCard(card, 1, new Date(card.due.getTime()));
    expect(lapsed.card.lapses).toBe(1);
    expect(lapsed.card.state).toBe('relearning');
    expect(lapsed.log.stateBefore).toBe('review');
    expect(lapsed.log.dueBefore).not.toBeNull();
  });

  it('is deterministic — the preview matches what grading actually does', () => {
    const card = newCard(NOW);
    const preview = previewIntervals(card, NOW);
    const graded = gradeCard(card, 4, NOW);
    const actual = Math.max(0, Math.ceil((graded.card.due.getTime() - NOW.getTime()) / 86_400_000));
    expect(actual).toBe(preview[4]);
  });

  it('classifies mastery by the scheduled interval', () => {
    expect(masteryOf({ ...newCard(NOW), state: 'review', scheduledDays: 6 })).toBe('young');
    expect(masteryOf({ ...newCard(NOW), state: 'review', scheduledDays: 30 })).toBe('mature');
    expect(masteryOf({ ...newCard(NOW), state: 'relearning' })).toBe('learning');
  });

  it('respects the learner s desired retention', () => {
    const card = gradeCard(newCard(NOW), 4, NOW).card;
    const cautious = previewIntervals(card, NOW, 0.95);
    const relaxed = previewIntervals(card, NOW, 0.8);
    expect(relaxed[3]).toBeGreaterThanOrEqual(cautious[3]);
  });
});

describe('localDateIn', () => {
  it('buckets a late-night Dhaka session into the local day, not the UTC one', () => {
    // 20:30 UTC on the 10th is 02:30 on the 11th in Dhaka.
    const at = new Date('2026-09-10T20:30:00Z');
    expect(localDateIn('Asia/Dhaka', at)).toBe('2026-09-11');
    expect(localDateIn('UTC', at)).toBe('2026-09-10');
  });
});
