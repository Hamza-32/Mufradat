import type { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { deckWords, decks, words } from '@/db/schema';
import { invalid, ok, serverError } from '@/lib/api/respond';
import { CONTENT_CACHE_CONTROL } from '@/lib/api/cache';

export const dynamic = 'force-dynamic';

/**
 * Word data for a guest's session. Content only — no learner state, nothing
 * about anyone's progress — so it needs no auth. A guest's card states live on
 * their own device and are joined there.
 */
const schema = z.object({
  deck: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return invalid(parsed.error);

  try {
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
      })
      .from(words)
      .innerJoin(deckWords, eq(deckWords.wordId, words.id))
      .innerJoin(decks, eq(decks.id, deckWords.deckId))
      .where(
        parsed.data.deck
          ? and(eq(deckWords.deckId, parsed.data.deck), eq(decks.isPublished, true))
          : eq(decks.isPublished, true),
      )
      .orderBy(asc(deckWords.deckId), asc(deckWords.orderIndex))
      .limit(parsed.data.limit ?? 300);

    // One entry per word: a word in two decks is still one card.
    const seen = new Set<string>();
    // Content only, same for everyone — cacheable at the edge. See /api/words.
    return ok(
      { candidates: rows.filter((row) => !seen.has(row.wordId) && seen.add(row.wordId)) },
      { headers: { 'Cache-Control': CONTENT_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error('candidate fetch failed', error);
    return serverError();
  }
}
