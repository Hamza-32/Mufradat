/**
 * Arabic normalisation for search and comparison.
 *
 * A learner may type: undiacriticised Arabic ("كتاب"), diacritised Arabic
 * ("كِتَاب"), a transliteration ("kitab", "kitāb"), Bengali ("বই") or English
 * ("book"). All of those must reach the same word, so every Arabic string is
 * reduced to one canonical form before it is indexed or compared.
 *
 * This module is pure and dependency-free on purpose: it runs in the seed
 * script, in API routes, and in the offline (IndexedDB) search path.
 */

/** Harakat, sukun, shadda, Quranic annotation signs, superscript alef. */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1\u08E3-\u08FF]/gu;

/** Tatweel / kashida — decorative letter stretching. */
const TATWEEL = /\u0640/gu;

/** Zero-width joiners, marks and BOM: invisible, but they break equality. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/gu;

/** Letter foldings required by the brief. */
const LETTER_FOLDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u0623\u0625\u0622\u0671\u0672\u0673\u0675]/gu, '\u0627'], // أ إ آ ٱ ٲ ٳ ٵ → ا
  [/[\u0649\u06CC]/gu, '\u064A'], // ى ی → ي
  [/\u0629/gu, '\u0647'], // ة → ه
  [/\u0624/gu, '\u0648'], // ؤ → و
  [/\u0626/gu, '\u064A'], // ئ → ي
  [/\u0640/gu, ''], // defensive: tatweel again
];

/** Arabic-Indic and extended Arabic-Indic digits → ASCII. */
const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/gu;

const collapseSpace = (value: string): string => value.replace(/\s+/gu, ' ').trim();

/** Remove vowel marks and kashida, keep the letters as written. */
export function stripTashkeel(input: string): string {
  return input.replace(INVISIBLE, '').replace(DIACRITICS, '').replace(TATWEEL, '');
}

/** Apply the orthographic foldings without touching diacritics. */
export function foldArabicLetters(input: string): string {
  return LETTER_FOLDS.reduce<string>(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    input,
  );
}

function foldArabicDigits(input: string): string {
  return input.replace(ARABIC_DIGITS, (digit) => {
    const code = digit.codePointAt(0) ?? 0;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Canonical Arabic form: no tashkeel, no tatweel, folded hamza/alef/ya/ta-marbuta.
 * Store this in `words.arabic_plain` and query against it.
 */
export function normalizeArabic(input: string): string {
  return collapseSpace(foldArabicDigits(foldArabicLetters(stripTashkeel(input))));
}

/**
 * Canonical Latin form for transliteration matching: NFD-decompose, drop
 * combining marks (so "kitāb" → "kitab", "ʿilm" → "ilm"), drop the ʿayn/hamza
 * modifier letters learners rarely type, lowercase.
 */
export function normalizeLatin(input: string): string {
  return collapseSpace(
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/gu, '')
      .replace(/[\u02BB-\u02BF\u02C0\u02C1\u2018\u2019'`]/gu, '')
      .toLowerCase(),
  );
}

/** Bengali: strip invisible joiners, collapse whitespace. Conjuncts are meaningful — keep them. */
export function normalizeBengali(input: string): string {
  return collapseSpace(input.replace(INVISIBLE, ''));
}

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const BENGALI_SCRIPT = /[\u0980-\u09FF]/u;

export type Script = 'arabic' | 'bengali' | 'latin' | 'unknown';

/** Which script is this string mostly in? Drives `lang`/`dir` and font choice. */
export function detectScript(input: string): Script {
  if (ARABIC_SCRIPT.test(input)) return 'arabic';
  if (BENGALI_SCRIPT.test(input)) return 'bengali';
  if (/[A-Za-z]/u.test(input)) return 'latin';
  return 'unknown';
}

/**
 * Normalise a user's query for the script they typed in. One entry point so the
 * server route and the offline Dexie index cannot drift apart.
 */
export function normalizeQuery(input: string): { script: Script; value: string } {
  const script = detectScript(input);
  switch (script) {
    case 'arabic':
      return { script, value: normalizeArabic(input) };
    case 'bengali':
      return { script, value: normalizeBengali(input) };
    case 'latin':
      return { script, value: normalizeLatin(input) };
    default:
      return { script, value: collapseSpace(input) };
  }
}

/**
 * Root letters as stored for display ("ك ت ب") reduced to a comparable key
 * ("كتب") so "related words sharing the root" is a single indexed lookup.
 */
export function normalizeRoot(input: string): string {
  return normalizeArabic(input).replace(/[\s\-–—.·]+/gu, '');
}

/** Root letters for display, always spaced right-to-left as written. */
export function formatRoot(input: string): string {
  return normalizeRoot(input).split('').join(' ');
}

/**
 * The blob written to `words.search_blob` and indexed with pg_trgm. Every
 * surface a learner might type is folded into one column.
 */
export function buildSearchBlob(parts: {
  arabic: string;
  transliteration: string;
  bengali: readonly string[];
  english: readonly string[];
  root?: string | null | undefined;
  tags?: readonly string[] | undefined;
}): string {
  const segments = [
    normalizeArabic(parts.arabic),
    normalizeLatin(parts.transliteration),
    ...parts.bengali.map(normalizeBengali),
    ...parts.english.map(normalizeLatin),
    parts.root ? normalizeRoot(parts.root) : '',
    ...(parts.tags ?? []).map(normalizeLatin),
  ];
  return collapseSpace(segments.filter(Boolean).join(' '));
}
