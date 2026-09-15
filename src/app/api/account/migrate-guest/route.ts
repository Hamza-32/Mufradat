import { and, eq, inArray, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import {
  dailyActivity,
  gameSessions,
  notes,
  reviewCards,
  reviewLogs,
  streaks,
  userSettings,
  users,
} from '@/db/schema';
import { requireUser, UnauthorizedError } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { fail, invalid, ok, rateLimited, serverError, unauthorized } from '@/lib/api/respond';
import { computeStreak, pickCard, toCardState } from '@/lib/guest/merge';
import { guestMigrationSchema, type MigrationResult } from '@/lib/guest/payload';

export const dynamic = 'force-dynamic';

/**
 * Move a guest's local progress into their new account.
 *
 * Three properties this route has to hold, in order of how much damage their
 * absence would do:
 *
 *  1. **Nothing is lost.** Review logs are append-only and every log from the
 *     device is kept. Where both sides hold a card for the same word, the merge
 *     policy in lib/guest/merge.ts decides, and it is tested.
 *  2. **Running it twice changes nothing.** Logs and games dedupe on their
 *     client event id, notes on their client id, cards on (user, word). The
 *     client may retry any batch after a dropped connection.
 *  3. **The account written to comes from the session.** The payload carries no
 *     user id; there is nothing here for a caller to forge.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    return serverError();
  }

  const limit = await rateLimit('migration', viewer.id);
  if (!limit.success) return rateLimited(limit.retryAfter);

  const parsed = guestMigrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const payload = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const written: MigrationResult = {
        cardsWritten: 0,
        logsWritten: 0,
        gamesWritten: 0,
        notesWritten: 0,
        cardsKept: 0,
        completed: false,
      };

      // --- settings: only if the account has none of its own yet -----------
      if (payload.settings) {
        await tx
          .insert(userSettings)
          .values({ userId: viewer.id, ...payload.settings })
          .onConflictDoNothing();
      }

      // --- cards: merge, do not overwrite ----------------------------------
      if (payload.cards.length > 0) {
        const wordIds = payload.cards.map((card) => card.wordId);
        const existing = await tx
          .select({
            wordId: reviewCards.wordId,
            lastReview: reviewCards.lastReview,
            reps: reviewCards.reps,
            stability: reviewCards.stability,
          })
          .from(reviewCards)
          .where(and(eq(reviewCards.userId, viewer.id), inArray(reviewCards.wordId, wordIds)));

        const byWord = new Map(existing.map((row) => [row.wordId, row]));

        for (const card of payload.cards) {
          const current = byWord.get(card.wordId) ?? null;
          if (pickCard(current, toCardState(card)) === 'existing') {
            written.cardsKept += 1;
            continue;
          }

          const row = {
            userId: viewer.id,
            wordId: card.wordId,
            deckId: card.deckId,
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsedDays: card.elapsedDays,
            scheduledDays: card.scheduledDays,
            learningSteps: card.learningSteps,
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            lastReview: card.lastReview === null ? null : new Date(card.lastReview),
            mastery: card.mastery,
            updatedAt: new Date(),
          };

          await tx
            .insert(reviewCards)
            .values(row)
            .onConflictDoUpdate({
              target: [reviewCards.userId, reviewCards.wordId],
              set: {
                deckId: row.deckId,
                due: row.due,
                stability: row.stability,
                difficulty: row.difficulty,
                elapsedDays: row.elapsedDays,
                scheduledDays: row.scheduledDays,
                learningSteps: row.learningSteps,
                reps: row.reps,
                lapses: row.lapses,
                state: row.state,
                lastReview: row.lastReview,
                mastery: row.mastery,
                updatedAt: row.updatedAt,
              },
            });
          written.cardsWritten += 1;
        }
      }

      // --- logs: append only, deduped on the client event id ----------------
      if (payload.logs.length > 0) {
        const inserted = await tx
          .insert(reviewLogs)
          .values(
            payload.logs.map((log) => ({
              userId: viewer.id,
              wordId: log.wordId,
              deckId: log.deckId,
              rating: log.rating,
              source: log.source,
              stateBefore: log.stateBefore,
              dueBefore: log.dueBefore === null ? null : new Date(log.dueBefore),
              stabilityBefore: log.stabilityBefore,
              difficultyBefore: log.difficultyBefore,
              elapsedDays: log.elapsedDays,
              lastElapsedDays: log.lastElapsedDays,
              scheduledDays: log.scheduledDays,
              elapsedMs: log.elapsedMs,
              clientEventId: log.clientEventId,
              reviewedAt: new Date(log.reviewedAt),
              localDate: log.localDate,
            })),
          )
          .onConflictDoNothing({ target: [reviewLogs.userId, reviewLogs.clientEventId] })
          .returning({ id: reviewLogs.id });
        written.logsWritten = inserted.length;
      }

      // --- games ------------------------------------------------------------
      if (payload.games.length > 0) {
        const inserted = await tx
          .insert(gameSessions)
          .values(
            payload.games.map((game) => ({
              userId: viewer.id,
              deckId: game.deckId,
              gameType: game.gameType,
              score: game.score,
              durationMs: game.durationMs,
              accuracy: game.accuracy,
              correctCount: game.correctCount,
              totalCount: game.totalCount,
              wordIds: game.wordIds,
              clientEventId: game.clientEventId,
              startedAt: new Date(game.startedAt),
              endedAt: game.endedAt === null ? null : new Date(game.endedAt),
              localDate: game.localDate,
            })),
          )
          .onConflictDoNothing({ target: [gameSessions.userId, gameSessions.clientEventId] })
          .returning({ id: gameSessions.id });
        written.gamesWritten = inserted.length;
      }

      // --- notes: last edit wins, keyed on the note's own client id ---------
      for (const note of payload.notes) {
        await tx
          .insert(notes)
          .values({
            userId: viewer.id,
            clientId: note.clientId,
            wordId: note.wordId,
            title: note.title,
            body: note.body,
            tags: note.tags,
            isPinned: note.isPinned,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
          })
          .onConflictDoUpdate({
            target: [notes.userId, notes.clientId],
            set: {
              wordId: note.wordId,
              title: note.title,
              body: note.body,
              tags: note.tags,
              isPinned: note.isPinned,
              updatedAt: new Date(note.updatedAt),
            },
            // Do not let an older device overwrite a newer edit.
            setWhere: sql`${notes.updatedAt} < ${new Date(note.updatedAt)}`,
          });
        written.notesWritten += 1;
      }

      // --- daily activity: derived from the logs, never accumulated ---------
      const touchedDates = [
        ...new Set([
          ...payload.logs.map((log) => log.localDate),
          ...payload.games.map((game) => game.localDate),
        ]),
      ];

      if (touchedDates.length > 0) {
        await tx.execute(sql`
          insert into daily_activity (
            user_id, local_date, review_count, new_count, game_count,
            correct_count, study_seconds
          )
          select
            l.user_id,
            l.local_date,
            count(*)::int,
            count(*) filter (where l.state_before = 'new')::int,
            coalesce((
              select count(*) from game_sessions g
              where g.user_id = l.user_id and g.local_date = l.local_date
            ), 0)::int,
            count(*) filter (where l.rating > 1)::int,
            (sum(l.elapsed_ms) / 1000)::int
          from review_logs l
          where l.user_id = ${viewer.id}
            and l.local_date in (${sql.join(
              touchedDates.map((date) => sql`${date}`),
              sql`, `,
            )})
          group by l.user_id, l.local_date
          on conflict (user_id, local_date) do update set
            review_count = excluded.review_count,
            new_count = excluded.new_count,
            game_count = excluded.game_count,
            correct_count = excluded.correct_count,
            study_seconds = excluded.study_seconds
        `);
      }

      // --- streak: recomputed from the dates, so re-running cannot inflate it
      const activeDates = await tx
        .select({ localDate: dailyActivity.localDate })
        .from(dailyActivity)
        .where(eq(dailyActivity.userId, viewer.id));

      if (activeDates.length > 0) {
        const settings = await tx
          .select({ timezone: userSettings.timezone })
          .from(userSettings)
          .where(eq(userSettings.userId, viewer.id))
          .limit(1);
        const timezone = settings[0]?.timezone ?? 'Asia/Dhaka';
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

        const streak = computeStreak(
          activeDates.map((row) => row.localDate),
          today,
        );
        await tx
          .insert(streaks)
          .values({
            userId: viewer.id,
            currentStreak: streak.current,
            longestStreak: streak.longest,
            lastActiveDate: streak.lastActiveDate,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: streaks.userId,
            set: {
              currentStreak: streak.current,
              longestStreak: streak.longest,
              lastActiveDate: streak.lastActiveDate,
              updatedAt: new Date(),
            },
          });
      }

      // --- only the final batch closes the migration ------------------------
      if (payload.final) {
        await tx.update(users).set({ guestMigratedAt: new Date() }).where(eq(users.id, viewer.id));
        written.completed = true;
      }

      return written;
    });

    return ok(result);
  } catch (error) {
    console.error('guest migration failed', { userId: viewer.id, error });
    return fail('server_error', 'Migration could not be completed', 500);
  }
}
