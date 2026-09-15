import type { Grade } from '@/lib/review/scheduler';

/**
 * How a game answer becomes a review grade.
 *
 * Games reuse the review queue so that playing counts as studying, which only
 * works if the grade they produce is honest. A word matched on the first try is
 * genuinely recalled; one found after two wrong taps is not, and must not be
 * scheduled as though it were.
 *
 *   0 mistakes → good (3). Recalled.
 *   1 mistake  → hard (2). Recalled, but with effort.
 *   2+, or ran out of time → again (1). Not recalled.
 *
 * Nothing here ever returns easy (4). Easy means "trivially certain", and a
 * multiple-choice tap with four options on screen cannot establish that.
 */
export function gradeFromMistakes(mistakes: number): Grade {
  if (mistakes <= 0) return 3;
  if (mistakes === 1) return 2;
  return 1;
}

/**
 * Score rewards accuracy first and speed second, and never goes negative — a
 * learner having a bad round should not be punished with a number that looks
 * like a rebuke.
 */
export function scoreRound(mistakes: number, msTaken: number): number {
  const base = mistakes === 0 ? 100 : mistakes === 1 ? 60 : 25;
  const speedBonus = Math.max(0, Math.round((8000 - Math.min(msTaken, 8000)) / 200));
  return base + (mistakes === 0 ? speedBonus : 0);
}
