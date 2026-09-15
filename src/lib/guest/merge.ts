import type { GuestCard } from './payload';

/**
 * What happens when a guest device and an account both know the same word.
 *
 * This is the whole reason migration is not a bulk insert. A learner can study
 * as a guest on their phone and already have an account from a laptop; both
 * sides hold FSRS state for كِتَاب. Overwriting either direction blindly would
 * throw away real scheduling information, so the rule is explicit and tested:
 *
 *   1. The card reviewed more recently wins — it has seen the learner last.
 *   2. If neither has been reviewed, or both at the same instant, the one with
 *      more repetitions wins.
 *   3. Still tied: the more stable card wins, because a longer interval is the
 *      more expensive thing to rebuild.
 *   4. Dead even: keep what is already in the account, so migration is a no-op
 *      rather than a churn.
 *
 * Review *logs* are never subject to this. Every log from both sides is kept —
 * the history is the one thing that must never be reconciled away.
 */

export interface CardState {
  lastReview: Date | null;
  reps: number;
  stability: number;
}

export type CardWinner = 'existing' | 'incoming';

export function pickCard(existing: CardState | null, incoming: CardState): CardWinner {
  if (!existing) return 'incoming';

  const existingSeen = existing.lastReview?.getTime() ?? 0;
  const incomingSeen = incoming.lastReview?.getTime() ?? 0;
  if (incomingSeen !== existingSeen) return incomingSeen > existingSeen ? 'incoming' : 'existing';

  if (incoming.reps !== existing.reps)
    return incoming.reps > existing.reps ? 'incoming' : 'existing';

  if (incoming.stability !== existing.stability) {
    return incoming.stability > existing.stability ? 'incoming' : 'existing';
  }

  return 'existing';
}

export function toCardState(card: GuestCard): CardState {
  return {
    lastReview: card.lastReview === null ? null : new Date(card.lastReview),
    reps: card.reps,
    stability: card.stability,
  };
}

/**
 * Rebuild a streak from the dates a learner was actually active. Derived, not
 * accumulated, so importing older guest activity repairs the streak instead of
 * corrupting it — and so running the migration twice cannot inflate it.
 *
 * @param activeDates Local dates (YYYY-MM-DD), any order, duplicates allowed.
 * @param today The learner's local date, not the server's.
 */
export function computeStreak(
  activeDates: readonly string[],
  today: string,
): { current: number; longest: number; lastActiveDate: string | null } {
  const unique = [...new Set(activeDates)].sort();
  if (unique.length === 0) return { current: 0, longest: 0, lastActiveDate: null };

  const dayMs = 86_400_000;
  const asTime = (date: string): number => Date.parse(`${date}T00:00:00Z`);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = asTime(unique[i]!) - asTime(unique[i - 1]!) === dayMs ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // A streak survives until the end of the following day: someone who studied
  // last night at 1am in Dhaka has not broken anything.
  const last = unique.at(-1)!;
  const gap = (asTime(today) - asTime(last)) / dayMs;
  const current = gap <= 1 ? run : 0;

  return { current, longest, lastActiveDate: last };
}
