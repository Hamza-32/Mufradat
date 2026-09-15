import {
  guestAdapter,
  newEventId,
  serverAdapter,
  type ReviewAdapter,
  type ReviewSource,
} from '@/lib/review/adapters';
import type { QueueResponseItem } from '@/lib/review/server';
import type { Grade } from '@/lib/review/scheduler';

export type GameType =
  'match_pairs' | 'multiple_choice' | 'listening' | 'spelling' | 'harakat' | 'streak_rush';

const SOURCE: Record<GameType, ReviewSource> = {
  match_pairs: 'game_match_pairs',
  multiple_choice: 'game_multiple_choice',
  listening: 'game_listening',
  spelling: 'game_spelling',
  harakat: 'game_harakat',
  streak_rush: 'game_streak_rush',
};

export interface GameRunner {
  /** The learner's own queue, so a round is made of words actually due. */
  loadWords(deckId?: string): Promise<QueueResponseItem[]>;
  /** Grade one word mid-round. Fire and forget; the outbox catches failures. */
  gradeWord(input: {
    wordId: string;
    deckId: string | null;
    grade: Grade;
    elapsedMs: number;
  }): void;
  /** Store the session envelope when the round ends. */
  finish(summary: {
    score: number;
    durationMs: number;
    correctCount: number;
    totalCount: number;
    wordIds: string[];
    startedAt: Date;
    deckId: string | null;
  }): Promise<void>;
}

/**
 * Both games below run on this. It wraps whichever review adapter is in play,
 * so grading inside a game goes through exactly the same scheduler as grading
 * on a flashcard — a game is a different interface to the same study session,
 * not a parallel scoring system.
 */
export function gameRunner(gameType: GameType, signedIn: boolean): GameRunner {
  const adapter: ReviewAdapter = signedIn ? serverAdapter() : guestAdapter();

  return {
    async loadWords(deckId) {
      // The pool, not the day's queue: a game must stay playable after the ten
      // daily new words are done.
      const queue = await adapter.loadPool(deckId);
      return queue.items;
    },

    gradeWord(input) {
      void adapter.submit({ ...input, clientEventId: newEventId(), source: SOURCE[gameType] });
    },

    async finish(summary) {
      const payload = {
        clientEventId: newEventId(),
        gameType,
        deckId: summary.deckId,
        score: summary.score,
        durationMs: summary.durationMs,
        correctCount: summary.correctCount,
        totalCount: summary.totalCount,
        wordIds: summary.wordIds,
        startedAt: summary.startedAt.toISOString(),
      };

      if (signedIn) {
        // Queued rather than lost if the round finished on a dead connection.
        const { postOrQueue } = await import('@/lib/offline/outbox');
        await postOrQueue('/api/games/session', 'game', payload.clientEventId, payload);
        return;
      }

      // Guest: the session lands in IndexedDB and is migrated on sign-in.
      const [{ guestDb, ensureGuestId }, { markGuestData }, { localDateIn }] = await Promise.all([
        import('@/lib/guest/db'),
        import('@/lib/guest/flag'),
        import('@/lib/review/scheduler'),
      ]);
      const db = guestDb();
      if (!db) return;
      await ensureGuestId();
      const settings = await db.settings.get('local');
      await db.games.put({
        clientEventId: payload.clientEventId,
        deckId: payload.deckId,
        gameType,
        score: payload.score,
        durationMs: payload.durationMs,
        accuracy: summary.totalCount === 0 ? 0 : summary.correctCount / summary.totalCount,
        correctCount: summary.correctCount,
        totalCount: summary.totalCount,
        wordIds: summary.wordIds,
        startedAt: payload.startedAt,
        endedAt: new Date().toISOString(),
        localDate: localDateIn(settings?.timezone ?? 'Asia/Dhaka'),
      });
      markGuestData();
    },
  };
}
