import { describe, expect, it } from 'vitest';
import { hasHarakat, splitHarakat } from './harakat';

describe('splitHarakat', () => {
  it('separates marks from their base letters without losing a character', () => {
    const tokens = splitHarakat('كِتَاب');
    expect(tokens.map((token) => token.text).join('')).toBe('كِتَاب');
    expect(tokens.filter((token) => token.isMark).length).toBeGreaterThan(0);
  });

  it('groups consecutive marks into one token', () => {
    const tokens = splitHarakat('مُحَمَّد');
    expect(tokens.every((token) => token.text.length > 0)).toBe(true);
    expect(tokens.map((token) => token.text).join('')).toBe('مُحَمَّد');
  });

  it('returns a single token for unvowelled text', () => {
    expect(splitHarakat('كتاب')).toEqual([{ text: 'كتاب', isMark: false }]);
  });
});

describe('hasHarakat', () => {
  it('tells vowelled from unvowelled', () => {
    expect(hasHarakat('كِتَاب')).toBe(true);
    expect(hasHarakat('كتاب')).toBe(false);
  });
});
