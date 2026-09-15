import { describe, expect, it } from 'vitest';
import { canonicalMarks, checkHarakat, gradeHarakat, harakatSlots, isPlayable } from './harakat';

const FATHA = '\u064E';
const KASRA = '\u0650';
const DAMMA = '\u064F';
const SUKUN = '\u0652';
const SHADDA = '\u0651';

describe('harakatSlots', () => {
  it('gives one slot per letter, with the marks attached to their own letter', () => {
    const slots = harakatSlots('كِتَاب');
    expect(slots.map((slot) => slot.letter)).toEqual(['ك', 'ت', 'ا', 'ب']);
    expect(slots.map((slot) => slot.marks)).toEqual([KASRA, FATHA, '', '']);
  });

  it('keeps shadda together with its vowel, in whichever order the text stores them', () => {
    // Real Arabic text encodes this pair both ways round, which is exactly why
    // canonicalMarks exists rather than a plain string comparison.
    const slots = harakatSlots('مُحَمَّد');
    const doubled = slots.find((slot) => slot.marks.includes(SHADDA));
    expect(doubled?.marks).toHaveLength(2);
    expect(canonicalMarks(doubled?.marks ?? '')).toBe(SHADDA + FATHA);
  });

  it('leaves an unvowelled word as all-empty slots', () => {
    const slots = harakatSlots('كتاب');
    expect(slots).toHaveLength(4);
    expect(slots.every((slot) => slot.marks === '')).toBe(true);
  });

  it('reconstructs the original word from its slots', () => {
    const word = 'اِمْرَأَة';
    expect(
      harakatSlots(word)
        .map((slot) => slot.letter + slot.marks)
        .join(''),
    ).toBe(word);
  });
});

describe('canonicalMarks', () => {
  it('accepts shadda tapped after the vowel as well as before', () => {
    expect(canonicalMarks(FATHA + SHADDA)).toBe(canonicalMarks(SHADDA + FATHA));
  });

  it('does not make two different vowels equal', () => {
    expect(canonicalMarks(FATHA)).not.toBe(canonicalMarks(KASRA));
  });
});

describe('checkHarakat', () => {
  const slots = harakatSlots('كِتَاب');

  it('passes a fully correct answer', () => {
    expect(checkHarakat([KASRA, FATHA, '', ''], slots)).toEqual({ correct: true, wrong: [] });
  });

  it('names exactly which letters are wrong', () => {
    expect(checkHarakat([FATHA, FATHA, '', ''], slots).wrong).toEqual([0]);
  });

  it('counts a mark on a letter that should carry none as wrong', () => {
    expect(checkHarakat([KASRA, FATHA, SUKUN, ''], slots).wrong).toEqual([2]);
  });

  it('counts a missing mark as wrong rather than ignoring it', () => {
    expect(checkHarakat([], slots).wrong).toEqual([0, 1]);
  });
});

describe('gradeHarakat', () => {
  it('never awards easy, however fast the answer', () => {
    expect(gradeHarakat(0)).toBe(3);
    expect(gradeHarakat(1)).toBe(2);
    expect(gradeHarakat(4)).toBe(1);
  });
});

describe('isPlayable', () => {
  it('accepts a word that actually carries vowels', () => {
    expect(isPlayable('كِتَاب')).toBe(true);
  });

  it('rejects a word with no vowels to restore', () => {
    expect(isPlayable('كتاب')).toBe(false);
  });

  it('rejects a single letter', () => {
    expect(isPlayable('لَ')).toBe(false);
  });
});

describe('damma and sukun round-trip', () => {
  it('survives a word using every mark', () => {
    const word = '\u062E' + DAMMA + '\u0628' + SUKUN + '\u0632';
    const slots = harakatSlots(word);
    expect(slots.map((slot) => slot.marks)).toEqual([DAMMA, SUKUN, '']);
    expect(checkHarakat([DAMMA, SUKUN, ''], slots).correct).toBe(true);
  });
});
