import { buildQueue, GAME_POOL_SIZE } from './queue-core';
import {
  gradeCard,
  localDateIn,
  masteryOf,
  newCard,
  previewIntervals,
  type Grade,
  type SchedulerCard,
} from './scheduler';
import type { QueueResponse, QueueResponseItem } from './server';

export type ReviewSource =
  | 'review'
  | 'game_match_pairs'
  | 'game_multiple_choice'
  | 'game_listening'
  | 'game_spelling'
  | 'game_harakat'
  | 'game_streak_rush';

/**
 * The review UI knows nothing about where cards are stored. A signed-in learner
 * talks to Postgres through the API; a guest talks to IndexedDB on their own
 * phone. Both go through the same scheduler and the same queue builder, so the
 * session is identical either way — guest mode is not a lesser product.
 */
export interface ReviewAdapter {
  loadQueue(deckId?: string): Promise<QueueResponse>;
  /**
   * The same queue with the daily new/review caps lifted. Games run on this:
   * they are practice over words the learner already has, not a second channel
   * for introducing new ones, so today's introduction budget must not empty a
   * game board.
   */
  loadPool(deckId?: string): Promise<QueueResponse>;
  submit(input: {
    wordId: string;
    deckId: string | null;
    grade: Grade;
    elapsedMs: number;
    clientEventId: string;
    /** Games record the same grade under their own source, so the stats page
        can separate "played" from "reviewed" without a second table. */
    source?: ReviewSource;
    /**
     * Never rejects. A grade that cannot be sent is queued on the device, so
     * the caller has nothing to handle and nothing to warn the learner about.
     */
  }): Promise<void>;
}

export function newEventId(): string {
  return globalThis.crypto.randomUUID().replace(/-/gu, '');
}

/* -------------------------------------------------------------------------- */
/* Signed in                                                                   */
/* -------------------------------------------------------------------------- */

export function serverAdapter(): ReviewAdapter {
  return {
    async loadQueue(deckId) {
      const params = deckId ? `?deck=${encodeURIComponent(deckId)}` : '';
      const response = await fetch(`/api/review/queue${params}`);
      if (!response.ok) throw new Error('queue');
      return (await response.json()) as QueueResponse;
    },
    async loadPool(deckId) {
      const params = new URLSearchParams({ pool: '1' });
      if (deckId) params.set('deck', deckId);
      const response = await fetch(`/api/review/queue?${params.toString()}`);
      if (!response.ok) throw new Error('queue');
      return (await response.json()) as QueueResponse;
    },
    async submit(input) {
      const payload = {
        ...input,
        source: input.source ?? 'review',
        // The moment the learner answered, not the moment the request left the
        // device — a review graded offline on Tuesday is a Tuesday review.
        answeredAt: new Date().toISOString(),
      };

      const { postOrQueue } = await import('@/lib/offline/outbox');
      await postOrQueue('/api/review/grade', 'grade', input.clientEventId, payload);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Guest                                                                       */
/* -------------------------------------------------------------------------- */

interface Candidate {
  wordId: string;
  deckId: string;
  deckOrder: number;
  frequencyRank: number | null;
  arabic: string;
  transliteration: string;
  bengaliMeanings: string[];
  englishMeanings: string[];
  audioPath: string | null;
  root: string | null;
  rootKey: string | null;
  tags: string[];
}

const GUEST_DEFAULTS = {
  dailyNewLimit: 10,
  dailyReviewLimit: 60,
  desiredRetention: 0.9,
  timezone: 'Asia/Dhaka',
};

function toSchedulerCard(row: {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: SchedulerCard['state'];
  lastReview: string | null;
}): SchedulerCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview === null ? null : new Date(row.lastReview),
  };
}

export function guestAdapter(): ReviewAdapter {
  async function build(deckId: string | undefined, pool: boolean): Promise<QueueResponse> {
    const [{ guestDb, ensureGuestId }, { markGuestData }] = await Promise.all([
      import('@/lib/guest/db'),
      import('@/lib/guest/flag'),
    ]);
    const db = guestDb();
    if (!db) throw new Error('no storage');
    markGuestData();
    await ensureGuestId();

    const params = deckId ? `?deck=${encodeURIComponent(deckId)}` : '';
    const response = await fetch(`/api/review/candidates${params}`);
    if (!response.ok) throw new Error('queue');
    const { candidates } = (await response.json()) as { candidates: Candidate[] };

    const settings = (await db.settings.get('local')) ?? GUEST_DEFAULTS;
    const now = new Date();
    const localDate = localDateIn(settings.timezone, now);

    const todaysLogs = await db.logs.where('localDate').equals(localDate).toArray();
    const doneToday = {
      reviews: todaysLogs.length,
      newWords: todaysLogs.filter((log) => log.stateBefore === 'new').length,
    };

    const stored = await db.cards.toArray();
    const byWord = new Map(stored.map((card) => [card.wordId, card]));
    const info = new Map(candidates.map((candidate) => [candidate.wordId, candidate]));

    const queue = buildQueue(
      candidates.map((candidate) => {
        const card = byWord.get(candidate.wordId);
        return {
          wordId: candidate.wordId,
          deckId: candidate.deckId,
          deckOrder: candidate.deckOrder,
          frequencyRank: candidate.frequencyRank,
          card: card ? toSchedulerCard(card) : null,
        };
      }),
      pool
        ? { newRemaining: GAME_POOL_SIZE, reviewRemaining: GAME_POOL_SIZE }
        : {
            newRemaining: settings.dailyNewLimit - doneToday.newWords,
            reviewRemaining: settings.dailyReviewLimit - doneToday.reviews,
          },
      now,
    );

    const items: QueueResponseItem[] = queue.flatMap((item) => {
      const candidate = info.get(item.wordId);
      if (!candidate) return [];
      return [
        {
          wordId: item.wordId,
          deckId: item.deckId,
          isNew: item.isNew,
          arabic: candidate.arabic,
          transliteration: candidate.transliteration,
          bengaliMeanings: candidate.bengaliMeanings,
          englishMeanings: candidate.englishMeanings,
          audioPath: candidate.audioPath,
          root: candidate.root,
          rootKey: candidate.rootKey,
          tags: candidate.tags,
          intervals: previewIntervals(item.card ?? newCard(now), now, settings.desiredRetention),
        },
      ];
    });

    return {
      items,
      doneToday,
      limits: { newPerDay: settings.dailyNewLimit, reviewsPerDay: settings.dailyReviewLimit },
      localDate,
    };
  }

  return {
    loadQueue: (deckId) => build(deckId, false),
    loadPool: (deckId) => build(deckId, true),

    async submit(input) {
      const [{ guestDb, ensureGuestId }, { markGuestData }] = await Promise.all([
        import('@/lib/guest/db'),
        import('@/lib/guest/flag'),
      ]);
      const db = guestDb();
      if (!db) throw new Error('no storage');
      await ensureGuestId();

      const settings = (await db.settings.get('local')) ?? GUEST_DEFAULTS;
      const now = new Date();
      const stored = await db.cards.get(input.wordId);
      const before = stored ? toSchedulerCard(stored) : newCard(now);
      const outcome = gradeCard(before, input.grade, now, settings.desiredRetention);

      await db.transaction('rw', [db.cards, db.logs], async () => {
        await db.cards.put({
          wordId: input.wordId,
          deckId: input.deckId,
          due: outcome.card.due.toISOString(),
          stability: outcome.card.stability,
          difficulty: outcome.card.difficulty,
          elapsedDays: outcome.card.elapsedDays,
          scheduledDays: outcome.card.scheduledDays,
          learningSteps: 0,
          reps: outcome.card.reps,
          lapses: outcome.card.lapses,
          state: outcome.card.state,
          lastReview: outcome.card.lastReview?.toISOString() ?? null,
          mastery: masteryOf(outcome.card),
        });
        // Same append-only discipline as the server: the local history is what
        // gets migrated when the learner signs in, so it is never overwritten.
        await db.logs.put({
          clientEventId: input.clientEventId,
          wordId: input.wordId,
          deckId: input.deckId,
          rating: input.grade,
          source: input.source ?? 'review',
          stateBefore: outcome.log.stateBefore,
          dueBefore: outcome.log.dueBefore?.toISOString() ?? null,
          stabilityBefore: outcome.log.stabilityBefore,
          difficultyBefore: outcome.log.difficultyBefore,
          elapsedDays: outcome.log.elapsedDays,
          lastElapsedDays: outcome.log.lastElapsedDays,
          scheduledDays: outcome.log.scheduledDays,
          elapsedMs: input.elapsedMs,
          reviewedAt: now.toISOString(),
          localDate: localDateIn(settings.timezone, now),
        });
      });

      markGuestData();
    },
  };
}
