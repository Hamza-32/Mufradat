import type { SchedulerCard } from './scheduler';

/**
 * Deciding what to show next, as a pure function, because the signed-in path
 * (Postgres) and the guest path (IndexedDB) must produce the same session. If
 * this lived in the API route, guest mode would quietly drift into a different
 * study experience.
 */

export interface QueueCandidate {
  wordId: string;
  deckId: string | null;
  /** Null for a word the learner has never seen. */
  card: SchedulerCard | null;
  /** Lower is commoner; used to choose which new words are introduced first. */
  frequencyRank: number | null;
  /** Position in the deck, which is an editorial teaching order. */
  deckOrder: number;
}

export interface QueueLimits {
  /** Remaining allowance for today, after what has already been studied. */
  newRemaining: number;
  reviewRemaining: number;
}

export interface QueueItem {
  wordId: string;
  deckId: string | null;
  card: SchedulerCard | null;
  isNew: boolean;
}

/**
 * Due cards carry the session; new words are sprinkled in rather than stacked
 * at either end. A block of unfamiliar words at the start is discouraging, and
 * a block at the end arrives when attention is already spent.
 */
const NEW_EVERY = 4;

/**
 * How many words a game may draw on. Lives here rather than in server.ts
 * because the guest adapter needs it on the client, and importing it from the
 * server module would pull the database into the browser bundle.
 */
export const GAME_POOL_SIZE = 200;

export function buildQueue(
  candidates: readonly QueueCandidate[],
  limits: QueueLimits,
  now: Date,
): QueueItem[] {
  const due = candidates
    .filter((item) => item.card !== null && item.card.due.getTime() <= now.getTime())
    .sort((a, b) => a.card!.due.getTime() - b.card!.due.getTime())
    .slice(0, Math.max(0, limits.reviewRemaining))
    .map<QueueItem>((item) => ({
      wordId: item.wordId,
      deckId: item.deckId,
      card: item.card,
      isNew: false,
    }));

  const fresh = candidates
    .filter((item) => item.card === null)
    .sort(
      (a, b) =>
        a.deckOrder - b.deckOrder ||
        (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) -
          (b.frequencyRank ?? Number.MAX_SAFE_INTEGER) ||
        a.wordId.localeCompare(b.wordId),
    )
    .slice(0, Math.max(0, limits.newRemaining))
    .map<QueueItem>((item) => ({
      wordId: item.wordId,
      deckId: item.deckId,
      card: null,
      isNew: true,
    }));

  if (fresh.length === 0) return due;
  if (due.length === 0) return fresh;

  const out: QueueItem[] = [];
  const newQueue = [...fresh];
  for (const [index, item] of due.entries()) {
    out.push(item);
    if ((index + 1) % NEW_EVERY === 0 && newQueue.length > 0) out.push(newQueue.shift()!);
  }
  out.push(...newQueue);
  return out;
}

/**
 * A card graded "again" comes back in the same sitting rather than being
 * scheduled days out and forgotten. It is re-inserted a few cards later so the
 * learner has to actually recall it, not just echo it.
 */
export const RELEARN_GAP = 3;

export function reinsert<T>(queue: readonly T[], item: T, gap = RELEARN_GAP): T[] {
  const next = [...queue];
  next.splice(Math.min(gap, next.length), 0, item);
  return next;
}
