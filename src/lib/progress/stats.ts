import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { dailyActivity, deckWords, decks, reviewCards, reviewLogs, streaks } from '@/db/schema';
import { getLearnerSettings } from '@/lib/review/server';
import { localDateIn } from '@/lib/review/scheduler';
import {
  buildForecast,
  buildHeatmap,
  retentionRate,
  type ForecastDay,
  type HeatmapCell,
  type MasteryCounts,
} from './heatmap';

export interface DeckProgress {
  deckId: string;
  titleBengali: string;
  titleEnglish: string;
  total: number;
  started: number;
  mature: number;
}

export interface ProgressStats {
  today: string;
  heatmap: HeatmapCell[][];
  streak: { current: number; longest: number };
  mastery: MasteryCounts;
  /** Null until the learner has actually been asked to recall something. */
  retention: number | null;
  retentionWindowDays: number;
  forecast: ForecastDay[];
  decks: DeckProgress[];
  totals: { reviews: number; daysStudied: number; minutes: number };
}

const RETENTION_WINDOW_DAYS = 90;

/**
 * Everything the progress page shows, read from `review_logs` and
 * `daily_activity`. The log table has been append-only since the first
 * migration precisely so this page could exist without anything having been
 * overwritten along the way.
 */
export async function getProgressStats(userId: string): Promise<ProgressStats> {
  const settings = await getLearnerSettings(userId);
  const now = new Date();
  const today = localDateIn(settings.timezone, now);
  const yearAgo = new Date(now.getTime() - 371 * 86_400_000).toISOString().slice(0, 10);
  const retentionFrom = new Date(now.getTime() - RETENTION_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [activity, streakRow, masteryRows, retentionRow, forecastRows, deckRows, totalsRow] =
    await Promise.all([
      db
        .select({ date: dailyActivity.localDate, count: dailyActivity.reviewCount })
        .from(dailyActivity)
        .where(and(eq(dailyActivity.userId, userId), gte(dailyActivity.localDate, yearAgo))),

      db
        .select({ current: streaks.currentStreak, longest: streaks.longestStreak })
        .from(streaks)
        .where(eq(streaks.userId, userId))
        .limit(1),

      db
        .select({ mastery: reviewCards.mastery, count: sql<number>`count(*)::int` })
        .from(reviewCards)
        .where(eq(reviewCards.userId, userId))
        .groupBy(reviewCards.mastery),

      // Retention counts only cards the learner had already learned. A word
      // seen for the first time cannot be forgotten, and counting it would drag
      // the number down for whoever is working hardest.
      db
        .select({
          reviewed: sql<number>`count(*)::int`,
          recalled: sql<number>`count(*) filter (where ${reviewLogs.rating} > 1)::int`,
        })
        .from(reviewLogs)
        .where(
          and(
            eq(reviewLogs.userId, userId),
            gte(reviewLogs.localDate, retentionFrom),
            sql`${reviewLogs.stateBefore} in ('review', 'relearning')`,
          ),
        ),

      db.execute<{ date: string; count: number }>(sql`
        select (greatest(${reviewCards.due}, now()) at time zone ${settings.timezone})::date::text as date,
               count(*)::int as count
        from ${reviewCards}
        where ${reviewCards.userId} = ${userId}
          and ${reviewCards.suspendedAt} is null
          and ${reviewCards.due} < now() + interval '14 days'
        group by 1
        order by 1
      `),

      db
        .select({
          deckId: decks.id,
          titleBengali: decks.titleBengali,
          titleEnglish: decks.titleEnglish,
          total: sql<number>`count(*)::int`,
          started: sql<number>`count(${reviewCards.id})::int`,
          mature: sql<number>`count(*) filter (where ${reviewCards.mastery} = 'mature')::int`,
        })
        .from(decks)
        .innerJoin(deckWords, eq(deckWords.deckId, decks.id))
        .leftJoin(
          reviewCards,
          and(eq(reviewCards.wordId, deckWords.wordId), eq(reviewCards.userId, userId)),
        )
        .where(eq(decks.isPublished, true))
        .groupBy(decks.id, decks.titleBengali, decks.titleEnglish, decks.orderIndex)
        .orderBy(decks.orderIndex),

      db
        .select({
          reviews: sql<number>`count(*)::int`,
          days: sql<number>`count(distinct ${reviewLogs.localDate})::int`,
          seconds: sql<number>`coalesce(sum(${reviewLogs.elapsedMs}), 0)::bigint / 1000`,
        })
        .from(reviewLogs)
        .where(eq(reviewLogs.userId, userId)),
    ]);

  const mastery: MasteryCounts = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const row of masteryRows) mastery[row.mastery] = row.count;

  return {
    today,
    heatmap: buildHeatmap(activity, today),
    streak: { current: streakRow[0]?.current ?? 0, longest: streakRow[0]?.longest ?? 0 },
    mastery,
    retention: retentionRate(retentionRow[0]?.reviewed ?? 0, retentionRow[0]?.recalled ?? 0),
    retentionWindowDays: RETENTION_WINDOW_DAYS,
    forecast: buildForecast([...forecastRows], today),
    decks: deckRows,
    totals: {
      reviews: totalsRow[0]?.reviews ?? 0,
      daysStudied: totalsRow[0]?.days ?? 0,
      minutes: Math.round(Number(totalsRow[0]?.seconds ?? 0) / 60),
    },
  };
}
