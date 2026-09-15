import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  dailyActivity,
  deckWords,
  decks,
  reviewCards,
  reviewLogs,
  streaks,
  userSettings,
  words,
} from '@/db/schema';
import { computeStreak } from '@/lib/guest/merge';
import { buildQueue, GAME_POOL_SIZE, type QueueCandidate, type QueueItem } from './queue-core';
import {
  gradeCard,
  localDateIn,
  newCard,
  previewIntervals,
  type Grade,
  type SchedulerCard,
} from './scheduler';

export interface LearnerSettings {
  dailyNewLimit: number;
  dailyReviewLimit: number;
  desiredRetention: number;
  timezone: string;
}

const DEFAULTS: LearnerSettings = {
  dailyNewLimit: 10,
  dailyReviewLimit: 60,
  desiredRetention: 0.9,
  timezone: 'Asia/Dhaka',
};

export async function getLearnerSettings(userId: string): Promise<LearnerSettings> {
  const rows = await db
    .select({
      dailyNewLimit: userSettings.dailyNewLimit,
      dailyReviewLimit: userSettings.dailyReviewLimit,
      desiredRetention: userSettings.desiredRetention,
      timezone: userSettings.timezone,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? DEFAULTS;
}

export interface QueueResponseItem {
  wordId: string;
  deckId: string | null;
  isNew: boolean;
  arabic: string;
  transliteration: string;
  bengaliMeanings: string[];
  englishMeanings: string[];
  audioPath: string | null;
  /** Root and tags travel with the card so the games can pick distractors that
      actually force a distinction, without a second round trip. */
  root: string | null;
  rootKey: string | null;
  tags: string[];
  /** Days until due under each of the four grades, computed before the answer. */
  intervals: Record<Grade, number>;
}

export interface QueueResponse {
  items: QueueResponseItem[];
  /** How much of today's allowance is already spent. Drives the "done" state. */
  doneToday: { reviews: number; newWords: number };
  limits: { newPerDay: number; reviewsPerDay: number };
  localDate: string;
}

/**
 * Assemble today's session. Caps are per local day and are read from what has
 * already been logged, so closing the app mid-session and coming back does not
 * hand out a fresh allowance.
 */
/**
 * `pool: true` lifts the daily new/review caps.
 *
 * Those caps pace how fast new words are *introduced* in a review session. A
 * game is practice over words the learner already has, so gating it on the same
 * budget meant every game went dead for the rest of the day the moment the ten
 * daily new words were done — and told the learner to "learn a few words first",
 * which was exactly backwards.
 */
export async function getQueue(
  userId: string,
  deckId?: string,
  options?: { pool?: boolean },
): Promise<QueueResponse> {
  const settings = await getLearnerSettings(userId);
  const now = new Date();
  const localDate = localDateIn(settings.timezone, now);

  const [today] = await db
    .select({ reviewCount: dailyActivity.reviewCount, newCount: dailyActivity.newCount })
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.localDate, localDate)))
    .limit(1);

  const doneToday = { reviews: today?.reviewCount ?? 0, newWords: today?.newCount ?? 0 };

  const deckFilter = deckId ? eq(deckWords.deckId, deckId) : eq(decks.isPublished, true);

  // One pass over the candidate words: everything in scope, with the learner's
  // card beside it when there is one.
  const rows = await db
    .select({
      wordId: words.id,
      deckId: deckWords.deckId,
      deckOrder: deckWords.orderIndex,
      frequencyRank: words.frequencyRank,
      arabic: words.arabic,
      transliteration: words.transliteration,
      bengaliMeanings: words.bengaliMeanings,
      englishMeanings: words.englishMeanings,
      audioPath: words.audioPath,
      root: words.root,
      rootKey: words.rootKey,
      tags: words.tags,
      due: reviewCards.due,
      stability: reviewCards.stability,
      difficulty: reviewCards.difficulty,
      elapsedDays: reviewCards.elapsedDays,
      scheduledDays: reviewCards.scheduledDays,
      reps: reviewCards.reps,
      lapses: reviewCards.lapses,
      state: reviewCards.state,
      lastReview: reviewCards.lastReview,
      suspendedAt: reviewCards.suspendedAt,
    })
    .from(words)
    .innerJoin(deckWords, eq(deckWords.wordId, words.id))
    .innerJoin(decks, eq(decks.id, deckWords.deckId))
    .leftJoin(reviewCards, and(eq(reviewCards.wordId, words.id), eq(reviewCards.userId, userId)))
    .where(
      and(
        deckFilter,
        isNull(reviewCards.suspendedAt),
        // Anything due now, or never seen. Cards scheduled for the future are
        // not fetched at all.
        or(isNull(reviewCards.id), lte(reviewCards.due, now)),
      ),
    )
    .orderBy(asc(deckWords.deckId), asc(deckWords.orderIndex))
    .limit(600);

  const byWord = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!byWord.has(row.wordId)) byWord.set(row.wordId, row);

  const candidates: QueueCandidate[] = [...byWord.values()].map((row) => ({
    wordId: row.wordId,
    deckId: row.deckId,
    frequencyRank: row.frequencyRank,
    deckOrder: row.deckOrder,
    card:
      row.due === null
        ? null
        : {
            due: row.due,
            stability: row.stability ?? 0,
            difficulty: row.difficulty ?? 0,
            elapsedDays: row.elapsedDays ?? 0,
            scheduledDays: row.scheduledDays ?? 0,
            reps: row.reps ?? 0,
            lapses: row.lapses ?? 0,
            state: row.state ?? 'new',
            lastReview: row.lastReview,
          },
  }));

  const queue: QueueItem[] = buildQueue(
    candidates,
    options?.pool === true
      ? { newRemaining: GAME_POOL_SIZE, reviewRemaining: GAME_POOL_SIZE }
      : {
          newRemaining: settings.dailyNewLimit - doneToday.newWords,
          reviewRemaining: settings.dailyReviewLimit - doneToday.reviews,
        },
    now,
  );

  return {
    items: queue.flatMap((item) => {
      const row = byWord.get(item.wordId);
      if (!row) return [];
      return [
        {
          wordId: item.wordId,
          deckId: item.deckId,
          isNew: item.isNew,
          arabic: row.arabic,
          transliteration: row.transliteration,
          bengaliMeanings: row.bengaliMeanings,
          englishMeanings: row.englishMeanings,
          audioPath: row.audioPath,
          root: row.root,
          rootKey: row.rootKey,
          tags: row.tags,
          intervals: previewIntervals(item.card ?? newCard(now), now, settings.desiredRetention),
        },
      ];
    }),
    doneToday,
    limits: { newPerDay: settings.dailyNewLimit, reviewsPerDay: settings.dailyReviewLimit },
    localDate,
  };
}

export interface GradeInput {
  wordId: string;
  deckId: string | null;
  grade: Grade;
  elapsedMs: number;
  clientEventId: string;
  source:
    | 'review'
    | 'game_match_pairs'
    | 'game_multiple_choice'
    | 'game_listening'
    | 'game_spelling'
    | 'game_harakat'
    | 'game_streak_rush';
  /** When the learner actually answered, which may be while offline. */
  answeredAt?: Date;
}

export interface GradeResult {
  card: SchedulerCard;
  intervals: Record<Grade, number>;
  duplicate: boolean;
}

/**
 * Apply one grade. Idempotent on `clientEventId`: an offline queue flushing
 * twice, or a retried request, records the review once and leaves the card
 * exactly where the first attempt left it.
 */
export async function applyGrade(userId: string, input: GradeInput): Promise<GradeResult> {
  const settings = await getLearnerSettings(userId);
  const now = input.answeredAt ?? new Date();
  const localDate = localDateIn(settings.timezone, now);

  return db.transaction(async (tx) => {
    const existingLog = await tx
      .select({ id: reviewLogs.id })
      .from(reviewLogs)
      .where(and(eq(reviewLogs.userId, userId), eq(reviewLogs.clientEventId, input.clientEventId)))
      .limit(1);

    const [current] = await tx
      .select()
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), eq(reviewCards.wordId, input.wordId)))
      .limit(1);

    if (existingLog.length > 0) {
      const card: SchedulerCard = current
        ? {
            due: current.due,
            stability: current.stability,
            difficulty: current.difficulty,
            elapsedDays: current.elapsedDays,
            scheduledDays: current.scheduledDays,
            reps: current.reps,
            lapses: current.lapses,
            state: current.state,
            lastReview: current.lastReview,
          }
        : newCard(now);
      return {
        card,
        intervals: previewIntervals(card, now, settings.desiredRetention),
        duplicate: true,
      };
    }

    const before: SchedulerCard = current
      ? {
          due: current.due,
          stability: current.stability,
          difficulty: current.difficulty,
          elapsedDays: current.elapsedDays,
          scheduledDays: current.scheduledDays,
          reps: current.reps,
          lapses: current.lapses,
          state: current.state,
          lastReview: current.lastReview,
        }
      : newCard(now);

    const outcome = gradeCard(before, input.grade, now, settings.desiredRetention);

    await tx
      .insert(reviewCards)
      .values({
        userId,
        wordId: input.wordId,
        deckId: input.deckId,
        due: outcome.card.due,
        stability: outcome.card.stability,
        difficulty: outcome.card.difficulty,
        elapsedDays: outcome.card.elapsedDays,
        scheduledDays: outcome.card.scheduledDays,
        reps: outcome.card.reps,
        lapses: outcome.card.lapses,
        state: outcome.card.state,
        lastReview: outcome.card.lastReview,
        mastery: outcome.mastery,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [reviewCards.userId, reviewCards.wordId],
        set: {
          due: outcome.card.due,
          stability: outcome.card.stability,
          difficulty: outcome.card.difficulty,
          elapsedDays: outcome.card.elapsedDays,
          scheduledDays: outcome.card.scheduledDays,
          reps: outcome.card.reps,
          lapses: outcome.card.lapses,
          state: outcome.card.state,
          lastReview: outcome.card.lastReview,
          mastery: outcome.mastery,
          updatedAt: new Date(),
        },
      });

    // Append-only. Nothing in the app ever updates a row in this table.
    await tx
      .insert(reviewLogs)
      .values({
        userId,
        wordId: input.wordId,
        deckId: input.deckId,
        rating: input.grade,
        source: input.source,
        stateBefore: outcome.log.stateBefore,
        dueBefore: outcome.log.dueBefore,
        stabilityBefore: outcome.log.stabilityBefore,
        difficultyBefore: outcome.log.difficultyBefore,
        elapsedDays: outcome.log.elapsedDays,
        lastElapsedDays: outcome.log.lastElapsedDays,
        scheduledDays: outcome.log.scheduledDays,
        elapsedMs: input.elapsedMs,
        clientEventId: input.clientEventId,
        reviewedAt: now,
        localDate,
      })
      .onConflictDoNothing({ target: [reviewLogs.userId, reviewLogs.clientEventId] });

    // Activity for the day is derived from the logs, so it cannot drift out of
    // step with them and a replayed grade cannot inflate it.
    await tx.execute(sql`
      insert into daily_activity (
        user_id, local_date, review_count, new_count, game_count, correct_count, study_seconds
      )
      select l.user_id, l.local_date,
        count(*)::int,
        count(*) filter (where l.state_before = 'new')::int,
        coalesce((select count(*) from game_sessions g
                  where g.user_id = l.user_id and g.local_date = l.local_date), 0)::int,
        count(*) filter (where l.rating > 1)::int,
        (sum(l.elapsed_ms) / 1000)::int
      from review_logs l
      where l.user_id = ${userId} and l.local_date = ${localDate}
      group by l.user_id, l.local_date
      on conflict (user_id, local_date) do update set
        review_count = excluded.review_count,
        new_count = excluded.new_count,
        game_count = excluded.game_count,
        correct_count = excluded.correct_count,
        study_seconds = excluded.study_seconds
    `);

    // The streak only moves on the first review of a day, so the full
    // recomputation runs once a day rather than once a card.
    const [streak] = await tx
      .select({ lastActiveDate: streaks.lastActiveDate })
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1);

    if (streak?.lastActiveDate !== localDate) {
      const dates = await tx
        .select({ localDate: dailyActivity.localDate })
        .from(dailyActivity)
        .where(eq(dailyActivity.userId, userId));
      const next = computeStreak(
        dates.map((row) => row.localDate),
        localDate,
      );
      await tx
        .insert(streaks)
        .values({
          userId,
          currentStreak: next.current,
          longestStreak: next.longest,
          lastActiveDate: next.lastActiveDate,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: streaks.userId,
          set: {
            currentStreak: next.current,
            longestStreak: next.longest,
            lastActiveDate: next.lastActiveDate,
            updatedAt: new Date(),
          },
        });
    }

    return {
      card: outcome.card,
      intervals: previewIntervals(outcome.card, now, settings.desiredRetention),
      duplicate: false,
    };
  });
}
