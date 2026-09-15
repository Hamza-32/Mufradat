/**
 * Splitting vowelled Arabic into base letters and their marks, so the marks can
 * be rubricated the way a manuscript's second hand added them in red.
 *
 * Marks are emitted as separate adjacent tokens rather than as their own
 * elements far from their base, which is the same technique tajweed-coloured
 * mushaf apps use; browsers shape across those inline boundaries.
 */

const MARK = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1\u08E3-\u08FF]/u;

export interface ScriptToken {
  text: string;
  isMark: boolean;
}

/** Group a string into alternating runs of base letters and vowel marks. */
export function splitHarakat(input: string): ScriptToken[] {
  const tokens: ScriptToken[] = [];
  for (const char of input) {
    const isMark = MARK.test(char);
    const last = tokens.at(-1);
    if (last && last.isMark === isMark) {
      last.text += char;
    } else {
      tokens.push({ text: char, isMark });
    }
  }
  return tokens;
}

/** Does this string carry any tashkeel at all? Drives the harakat toggle. */
export function hasHarakat(input: string): boolean {
  return MARK.test(input);
}
