import type { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { dailyActivity, gameSessions, userSettings } from '@/db/schema';
import { requireUser, UnauthorizedError } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { localDateIn } from '@/lib/review/scheduler';
import { invalid, ok, rateLimited, serverError, unauthorized } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/**
 * Records a finished game. The individual answers are already in `review_logs`
 * — graded through the review endpoint as the round was played, which is what
 * makes playing count as studying. This route stores only the session envelope:
 * what was played, how well, and how long it took.
 */
const schema = z.object({
  clientEventId: z.string().min(8).max(64),
  gameType: z.enum([
    'match_pairs',
    'multiple_choice',
    'listening',
    'spelling',
    'harakat',
    'streak_rush',
  ]),
  deckId: z.string().min(1).max(64).nullable().default(null),
  score: z.number().int().min(0).max(100_000),
  durationMs: z.number().int().min(0).max(3_600_000),
  correctCount: z.number().int().min(0).max(500),
  totalCount: z.number().int().min(0).max(500),
  wordIds: z.array(z.string().min(1).max(64)).max(60),
  startedAt: z.string().datetime({ offset: true }),
});

export async function POST(request: NextRequest): Promise<Response> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    return serverError();
  }

  const limit = await rateLimit('games', viewer.id);
  if (!limit.success) return rateLimited(limit.retryAfter);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const body = parsed.data;

  try {
    const [settings] = await db
      .select({ timezone: userSettings.timezone })
      .from(userSettings)
      .where(eq(userSettings.userId, viewer.id))
      .limit(1);
    const timezone = settings?.timezone ?? 'Asia/Dhaka';
    const now = new Date();
    const localDate = localDateIn(timezone, now);

    await db.transaction(async (tx) => {
      await tx
        .insert(gameSessions)
        .values({
          userId: viewer.id,
          clientEventId: body.clientEventId,
          gameType: body.gameType,
          deckId: body.deckId,
          score: body.score,
          durationMs: body.durationMs,
          accuracy: body.totalCount === 0 ? 0 : body.correctCount / body.totalCount,
          correctCount: body.correctCount,
          totalCount: body.totalCount,
          wordIds: body.wordIds,
          startedAt: new Date(body.startedAt),
          endedAt: now,
          localDate,
        })
        // Idempotent, like every other write the client can retry.
        .onConflictDoNothing({ target: [gameSessions.userId, gameSessions.clientEventId] });

      // The day's game count is derived, so a replayed request cannot inflate it.
      await tx
        .insert(dailyActivity)
        .values({
          userId: viewer.id,
          localDate,
          gameCount: sql`(select count(*)::int from game_sessions g
                          where g.user_id = ${viewer.id} and g.local_date = ${localDate})`,
        })
        .onConflictDoUpdate({
          target: [dailyActivity.userId, dailyActivity.localDate],
          set: {
            gameCount: sql`(select count(*)::int from game_sessions g
                            where g.user_id = ${viewer.id} and g.local_date = ${localDate})`,
          },
        });
    });

    return ok({ recorded: true });
  } catch (error) {
    console.error('game session record failed', error);
    return serverError();
  }
}

export function GET(): Response {
  // Present so a stray GET returns 405 rather than the Next 404 page.
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
