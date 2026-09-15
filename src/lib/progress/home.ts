import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { dailyActivity, deckWords, reviewCards, streaks } from '@/db/schema';
import { getLearnerSettings } from '@/lib/review/server';
import { localDateIn } from '@/lib/review/scheduler';

export interface HomeSummary {
  dueCount: number;
  newAvailable: number;
  streak: { current: number; longest: number };
  /** Reviews per day for the last fourteen local days, oldest first. */
  activity: number[];
  decks: { deckId: string; learned: number; total: number; due: number }[];
}

function dateKey(base: Date, offsetDays: number, timezone: string): string {
  return localDateIn(timezone, new Date(base.getTime() + offsetDays * 86_400_000));
}

/**
 * Everything the home screen needs, in three queries. The counts are the real
 * ones — a home screen that overstates what is waiting is worse than one that
 * says nothing, because the learner stops believing it.
 */
export async function getHomeSummary(userId: string): Promise<HomeSummary> {
  const settings = await getLearnerSettings(userId);
  const now = new Date();
  const today = localDateIn(settings.timezone, now);
  const from = dateKey(now, -13, settings.timezone);

  const [dueRows, streakRows, activityRows, deckRows] = await Promise.all([
    db
      .select({
        due: sql<number>`count(*) filter (where ${reviewCards.due} <= now())::int`,
      })
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), sql`${reviewCards.suspendedAt} is null`)),
    db
      .select({ current: streaks.currentStreak, longest: streaks.longestStreak })
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1),
    db
      .select({
        localDate: dailyActivity.localDate,
        reviews: dailyActivity.reviewCount,
        newWords: dailyActivity.newCount,
      })
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, userId),
          gte(dailyActivity.localDate, from),
          lte(dailyActivity.localDate, today),
        ),
      ),
    db
      .select({
        deckId: deckWords.deckId,
        total: sql<number>`count(*)::int`,
        learned: sql<number>`count(${reviewCards.id})::int`,
        due: sql<number>`count(*) filter (where ${reviewCards.due} <= now())::int`,
      })
      .from(deckWords)
      .leftJoin(
        reviewCards,
        and(eq(reviewCards.wordId, deckWords.wordId), eq(reviewCards.userId, userId)),
      )
      .groupBy(deckWords.deckId),
  ]);

  const byDate = new Map(activityRows.map((row) => [row.localDate, row.reviews]));
  const newToday = activityRows.find((row) => row.localDate === today)?.newWords ?? 0;
  const activity = Array.from(
    { length: 14 },
    (_, index) => byDate.get(dateKey(now, index - 13, settings.timezone)) ?? 0,
  );

  const decks = deckRows.map((row) => ({
    deckId: row.deckId,
    learned: row.learned,
    total: row.total,
    due: row.due,
  }));

  return {
    dueCount: dueRows[0]?.due ?? 0,
    // What is left of today's allowance for words the learner has not met.
    newAvailable: Math.max(0, settings.dailyNewLimit - newToday),
    streak: { current: streakRows[0]?.current ?? 0, longest: streakRows[0]?.longest ?? 0 },
    activity,
    decks,
  };
}
