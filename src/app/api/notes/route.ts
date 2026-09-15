import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, UnauthorizedError } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { listNotes, listTags, saveNote } from '@/lib/notes/queries';
import { invalid, ok, rateLimited, serverError, unauthorized } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

const listSchema = z.object({
  q: z.string().max(200).optional(),
  tag: z.string().max(40).optional(),
  word: z.string().max(64).optional(),
});

const saveSchema = z.object({
  clientId: z.string().min(8).max(64),
  wordId: z.string().min(1).max(64).nullable().default(null),
  title: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  isPinned: z.boolean().default(false),
});

export async function GET(request: NextRequest): Promise<Response> {
  const viewer = await requireUser().catch((error: unknown) => {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  });
  if (!viewer) return unauthorized();

  const parsed = listSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [items, tags] = await Promise.all([
      listNotes(viewer.id, {
        query: parsed.data.q,
        tag: parsed.data.tag,
        wordId: parsed.data.word,
      }),
      listTags(viewer.id),
    ]);
    return ok({ notes: items, tags });
  } catch (error) {
    console.error('note list failed', error);
    return serverError();
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    return serverError();
  }

  const limit = await rateLimit('notes', viewer.id);
  if (!limit.success) return rateLimited(limit.retryAfter);

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);

  try {
    return ok(await saveNote(viewer.id, parsed.data));
  } catch (error) {
    console.error('note save failed', error);
    return serverError();
  }
}
