import { splitHarakat } from '@/lib/arabic/harakat';
import type { Grade } from '@/lib/review/scheduler';

/**
 * The harakat challenge: the learner is shown a word stripped of its vowels and
 * has to put them back.
 *
 * A "slot" is one base letter plus whatever marks sit on it. Most slots in real
 * words are empty — a final letter usually carries nothing in a wordlist form —
 * and that matters, because a learner who marks every letter is as wrong as one
 * who marks none.
 */

export interface HarakatSlot {
  /** The bare letter, as displayed. */
  letter: string;
  /** The marks that belong on it: '' for none, 'َ', or 'َّ' for shadda + vowel. */
  marks: string;
}

const SHADDA = '\u0651';

export function harakatSlots(vowelled: string): HarakatSlot[] {
  const slots: HarakatSlot[] = [];

  for (const token of splitHarakat(vowelled)) {
    if (token.isMark) {
      const last = slots.at(-1);
      if (last) last.marks += token.text;
      continue;
    }
    // A run of base letters is several slots, one per letter.
    for (const letter of token.text) slots.push({ letter, marks: '' });
  }

  return slots;
}

/**
 * Shadda is written before its vowel (ّ then َ), but a learner may tap them in
 * either order. Comparing sorted marks would also accept nonsense like two
 * vowels, so instead the shadda is pulled to the front and the rest compared
 * as typed.
 */
export function canonicalMarks(marks: string): string {
  const characters = [...marks];
  const shadda = characters.filter((character) => character === SHADDA);
  const rest = characters.filter((character) => character !== SHADDA);
  return [...shadda, ...rest].join('');
}

export interface HarakatCheck {
  correct: boolean;
  /** Indices the learner got wrong, for highlighting exactly those letters. */
  wrong: number[];
}

export function checkHarakat(
  placed: readonly string[],
  slots: readonly HarakatSlot[],
): HarakatCheck {
  const wrong: number[] = [];
  for (const [index, slot] of slots.entries()) {
    const typed = canonicalMarks(placed[index] ?? '');
    if (typed !== canonicalMarks(slot.marks)) wrong.push(index);
  }
  return { correct: wrong.length === 0, wrong };
}

/** Same ladder as the other games: a clean answer is good, never easy. */
export function gradeHarakat(mistakes: number): Grade {
  if (mistakes <= 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

/**
 * Words worth asking about. A word whose every slot is empty has no puzzle in
 * it, and one with a single short letter is not worth the round trip.
 */
export function isPlayable(vowelled: string): boolean {
  const slots = harakatSlots(vowelled);
  return slots.length >= 2 && slots.some((slot) => slot.marks !== '');
}
