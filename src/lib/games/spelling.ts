import { normalizeArabic } from '@/lib/arabic/normalize';
import type { Grade } from '@/lib/review/scheduler';

/**
 * Marking a spelling answer.
 *
 * Three outcomes, not two, because "right letters, wrong vowels" is real
 * progress and marking it simply wrong would be both discouraging and
 * inaccurate. A learner who writes كتاب for كِتَاب knows the word; they do not
 * yet know the vowels.
 */
export type SpellingVerdict = 'exact' | 'letters-only' | 'wrong';

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u0640]/gu;

function tidy(value: string): string {
  return value.replace(INVISIBLE, '').replace(/\s+/gu, ' ').trim();
}

export function checkSpelling(input: string, target: string): SpellingVerdict {
  const typed = tidy(input);
  const answer = tidy(target);
  if (typed.length === 0) return 'wrong';
  if (typed === answer) return 'exact';

  // Compare through the same normaliser the search index uses, so a learner who
  // writes ا for أ is not failed on an orthographic convention nobody types.
  // Leaving the vowels off and getting them wrong are the same verdict: both
  // mean the consonants are known and the vowels are not.
  if (normalizeArabic(typed) === normalizeArabic(answer)) return 'letters-only';

  return 'wrong';
}

/**
 * A perfect answer is "good", never "easy" — the same rule the other games
 * follow. Getting the consonants right but the vowels wrong costs one mistake,
 * which is exactly what it is worth.
 */
export function gradeSpelling(verdict: SpellingVerdict, mistakes: number): Grade {
  const penalty = verdict === 'letters-only' ? mistakes + 1 : mistakes;
  if (penalty <= 0) return 3;
  if (penalty === 1) return 2;
  return 1;
}

/** Which characters of the answer the learner has right so far, for the hint row. */
export function revealMask(input: string, target: string): boolean[] {
  const typed = tidy(input);
  return [...tidy(target)].map((character, index) => typed[index] === character);
}
