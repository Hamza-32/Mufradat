/**
 * Typing Arabic on a physical keyboard, for a learner who does not have an
 * Arabic layout installed — which is nearly all of them.
 *
 * The scheme is phonetic rather than positional (Buckwalter, QWERTY-Arabic), so
 * it can be guessed from the transliteration the app already shows beside every
 * word: `kitaab` produces كتاب. Capitals mark the emphatic consonants, which is
 * the one convention worth learning because Bengali has no ص/س distinction to
 * fall back on.
 *
 * This is a helper, not a full input method. The on-screen keyboard is always
 * available on the same screen for anything the scheme cannot express.
 */

/** Longest sequences first: `sh` must win over `s`, `aa` over `a`. */
const SEQUENCES: ReadonlyArray<readonly [string, string]> = [
  // Digraph consonants
  ['kh', '\u062E'],
  ['gh', '\u063A'],
  ['sh', '\u0634'],
  ['th', '\u062B'],
  ['dh', '\u0630'],
  // Long vowels
  ['aa', '\u0627'],
  ['ee', '\u064A'],
  ['ii', '\u064A'],
  ['oo', '\u0648'],
  ['uu', '\u0648'],
  // Hamza seats
  ["w'", '\u0624'],
  ["y'", '\u0626'],
];

const SINGLES: Readonly<Record<string, string>> = {
  // Consonants
  b: '\u0628',
  t: '\u062A',
  j: '\u062C',
  d: '\u062F',
  r: '\u0631',
  z: '\u0632',
  s: '\u0633',
  f: '\u0641',
  q: '\u0642',
  k: '\u0643',
  l: '\u0644',
  m: '\u0645',
  n: '\u0646',
  h: '\u0647',
  w: '\u0648',
  y: '\u064A',
  // Emphatics and the throat letters, marked by a capital
  S: '\u0635',
  D: '\u0636',
  T: '\u0637',
  Z: '\u0638',
  H: '\u062D',
  // Hamza and ayn
  "'": '\u0621',
  '`': '\u0639',
  '3': '\u0639',
  // Alef with its seats
  A: '\u0623',
  I: '\u0625',
  M: '\u0622',
  Y: '\u0649',
  // Ta marbuta: no obvious Latin letter is free, so it gets its own key and is
  // spelled out in the helper panel.
  x: '\u0629',
  // Short vowels and the other marks
  a: '\u064E',
  i: '\u0650',
  u: '\u064F',
  o: '\u0652',
  '~': '\u0651',
};

export interface TranslitKey {
  latin: string;
  arabic: string;
  /** Shown in the helper panel so the scheme is discoverable, not memorised. */
  hint: string;
}

/** The rows of the helper panel, in the order a learner scans them. */
export const TRANSLIT_GUIDE: ReadonlyArray<{ label: string; keys: TranslitKey[] }> = [
  {
    label: 'consonants',
    keys: [
      {
        latin: 'b t j d r z s f q k l m n h w y',
        arabic: 'ب ت ج د ر ز س ف ق ك ل م ن ه و ي',
        hint: '',
      },
      { latin: 'th dh sh kh gh', arabic: 'ث ذ ش خ غ', hint: '' },
      { latin: 'S D T Z H', arabic: 'ص ض ط ظ ح', hint: 'capital = emphatic' },
      { latin: "' ` x", arabic: 'ء ع ة', hint: '' },
    ],
  },
  {
    label: 'vowels',
    keys: [
      { latin: 'a i u', arabic: 'َ ِ ُ', hint: 'short' },
      { latin: 'aa ee oo', arabic: 'ا ي و', hint: 'long' },
      { latin: 'o ~', arabic: 'ْ ّ', hint: 'sukun, shadda' },
    ],
  },
];

/** True when the string contains nothing but Latin letters and scheme symbols. */
export function isLatinInput(input: string): boolean {
  return input.length > 0 && !/[\u0600-\u06FF]/u.test(input) && /[A-Za-z'`~3]/u.test(input);
}

/**
 * Converts as much as it recognises and passes anything else through, so a
 * half-typed word never disappears from under the learner's fingers.
 */
export function latinToArabic(input: string): string {
  let out = '';
  let index = 0;

  outer: while (index < input.length) {
    for (const [latin, arabic] of SEQUENCES) {
      if (input.startsWith(latin, index)) {
        out += arabic;
        index += latin.length;
        continue outer;
      }
    }
    const single = SINGLES[input[index]!];
    out += single ?? input[index]!;
    index += 1;
  }

  return out;
}
