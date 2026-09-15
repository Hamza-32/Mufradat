import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { applyGrade } from '@/lib/review/server';
import { invalid, ok, rateLimited, serverError, unauthorized } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

const schema = z.object({
  wordId: z.string().min(1).max(64),
  deckId: z.string().min(1).max(64).nullable().default(null),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  /** Generated on the device. The idempotency key for the whole operation. */
  clientEventId: z.string().min(8).max(64),
  source: z
    .enum([
      'review',
      'game_match_pairs',
      'game_multiple_choice',
      'game_listening',
      'game_spelling',
      'game_harakat',
      'game_streak_rush',
    ])
    .default('review'),
  /** When the learner answered, for reviews graded while offline. */
  answeredAt: z.string().datetime({ offset: true }).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    return serverError();
  }

  const limit = await rateLimit('review', viewer.id);
  if (!limit.success) return rateLimited(limit.retryAfter);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  const { answeredAt, ...rest } = parsed.data;
  try {
    const result = await applyGrade(viewer.id, {
      ...rest,
      // A device clock can be wrong or deliberately set forward; never let it
      // schedule a review in the future.
      ...(answeredAt ? { answeredAt: clampToNow(new Date(answeredAt)) } : {}),
    });
    return ok(result);
  } catch (error) {
    console.error('grade failed', error);
    return serverError();
  }
}

function clampToNow(date: Date): Date {
  const now = new Date();
  return date.getTime() > now.getTime() ? now : date;
}
