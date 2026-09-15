import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { searchWords } from '@/lib/words/queries';
import { invalid, ok, serverError } from '@/lib/api/respond';
import { CONTENT_CACHE_CONTROL } from '@/lib/api/cache';

export const dynamic = 'force-dynamic';

/**
 * Read-only, so no auth and no rate limit — the content is the same for every
 * learner, signed in or not, and a guest browsing the dictionary is a feature.
 */
const querySchema = z.object({
  q: z.string().max(120).optional(),
  deck: z.string().max(64).optional(),
  pos: z
    .enum([
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'particle',
      'phrase',
      'proper_noun',
    ])
    .optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await searchWords({
      query: parsed.data.q,
      deckId: parsed.data.deck,
      partOfSpeech: parsed.data.pos,
      tag: parsed.data.tag,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    // The dictionary is identical for every caller and only changes on a reseed,
    // so let the CDN answer repeat queries instead of the database. On a free
    // Postgres tier the compute this saves is the difference that matters.
    return ok(result, { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } });
  } catch (error) {
    console.error('word search failed', error);
    return serverError();
  }
}
