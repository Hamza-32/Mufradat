import { describe, expect, it } from 'vitest';
import { checkSpelling, gradeSpelling, revealMask } from './spelling';
import { isLatinInput, latinToArabic } from './translit';

describe('checkSpelling', () => {
  it('accepts the word written exactly, vowels and all', () => {
    expect(checkSpelling('كِتَاب', 'كِتَاب')).toBe('exact');
  });

  it('ignores stray whitespace and kashida rather than failing on them', () => {
    expect(checkSpelling('  كِتَاب ', 'كِتَاب')).toBe('exact');
    expect(checkSpelling('كِـتَاب', 'كِتَاب')).toBe('exact');
  });

  it('marks right letters without vowels as partial, not wrong', () => {
    expect(checkSpelling('كتاب', 'كِتَاب')).toBe('letters-only');
  });

  it('forgives an orthographic hamza seat nobody types', () => {
    expect(checkSpelling('امراه', 'اِمْرَأَة')).toBe('letters-only');
  });

  it('marks a different word wrong', () => {
    expect(checkSpelling('قلم', 'كِتَاب')).toBe('wrong');
  });

  it('treats an empty answer as wrong rather than as a partial match', () => {
    expect(checkSpelling('', 'كِتَاب')).toBe('wrong');
    expect(checkSpelling('   ', 'كِتَاب')).toBe('wrong');
  });
});

describe('gradeSpelling', () => {
  it('gives a clean answer good, never easy', () => {
    expect(gradeSpelling('exact', 0)).toBe(3);
  });

  it('charges one mistake for missing vowels', () => {
    expect(gradeSpelling('letters-only', 0)).toBe(2);
  });

  it('drops to again once the learner has already slipped', () => {
    expect(gradeSpelling('exact', 2)).toBe(1);
    expect(gradeSpelling('letters-only', 1)).toBe(1);
  });
});

describe('revealMask', () => {
  it('marks the characters typed correctly so far', () => {
    expect(revealMask('كت', 'كتب')).toEqual([true, true, false]);
  });

  it('marks nothing for an empty attempt', () => {
    expect(revealMask('', 'كتب')).toEqual([false, false, false]);
  });
});

describe('latinToArabic', () => {
  it('builds a word from its transliteration', () => {
    expect(latinToArabic('kitaab')).toBe('كِتاب');
    expect(latinToArabic('qalam')).toBe('قَلَم');
  });

  it('prefers digraphs over single letters', () => {
    expect(latinToArabic('shams')).toBe('\u0634\u064E\u0645\u0633');
    expect(latinToArabic('khubz')).toBe('\u062E\u064F\u0628\u0632');
  });

  it('uses capitals for the emphatics', () => {
    expect(latinToArabic('Salaax')).toContain('\u0635');
    expect(latinToArabic('Salaax')).toContain('\u0629');
  });

  it('passes through anything it does not recognise', () => {
    expect(latinToArabic('كتاب')).toBe('كتاب');
    expect(latinToArabic('?')).toBe('?');
  });
});

describe('isLatinInput', () => {
  it('spots a learner typing in Latin so the helper can convert', () => {
    expect(isLatinInput('kitaab')).toBe(true);
  });

  it('leaves Arabic alone', () => {
    expect(isLatinInput('كتاب')).toBe(false);
    expect(isLatinInput('')).toBe(false);
  });
});
