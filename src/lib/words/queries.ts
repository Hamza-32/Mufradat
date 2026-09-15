import { and, asc, eq, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { deckWords, decks, examples, words } from '@/db/schema';
import { normalizeQuery } from '@/lib/arabic/normalize';

/**
 * Search has to work from four directions at once: undiacriticised Arabic,
 * diacritised Arabic, a transliteration, Bengali, or English. All of them are
 * folded into `words.search_blob` by the seed, and the query is folded the same
 * way here — one normaliser, so the index and the query can never drift.
 */

export interface WordSummary {
  id: string;
  arabic: string;
  transliteration: string;
  bengaliMeanings: string[];
  englishMeanings: string[];
  partOfSpeech: string;
  root: string | null;
  audioPath: string | null;
  needsReview: boolean;
}

export interface WordSearchParams {
  query?: string | undefined;
  deckId?: string | undefined;
  partOfSpeech?: string | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface WordSearchResult {
  words: WordSummary[];
  total: number;
  /** Null when this page is the last one. */
  nextOffset: number | null;
}

const COLUMNS = {
  id: words.id,
  arabic: words.arabic,
  transliteration: words.transliteration,
  bengaliMeanings: words.bengaliMeanings,
  englishMeanings: words.englishMeanings,
  partOfSpeech: words.partOfSpeech,
  root: words.root,
  audioPath: words.audioPath,
  needsReview: words.needsReview,
};

const MAX_LIMIT = 60;

export async function searchWords(params: WordSearchParams): Promise<WordSearchResult> {
  const limit = Math.min(Math.max(params.limit ?? 24, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const filters: SQL[] = [];
  let normalized = '';

  if (params.query?.trim()) {
    const { script, value } = normalizeQuery(params.query.trim());
    normalized = value;
    const like = `%${value}%`;
    filters.push(
      script === 'arabic'
        ? // Arabic typed without vowels must still find the vowelled headword,
          // and a root typed on its own must find the whole family.
          (or(
            sql`${words.arabicPlain} like ${like}`,
            sql`${words.searchBlob} like ${like}`,
            sql`${words.pluralPlain} like ${like}`,
          ) as SQL)
        : (sql`${words.searchBlob} like ${like}` as SQL),
    );
  }

  if (params.partOfSpeech) {
    filters.push(sql`${words.partOfSpeech}::text = ${params.partOfSpeech}`);
  }
  if (params.tag) {
    filters.push(sql`${words.tags} @> ${JSON.stringify([params.tag])}::jsonb`);
  }
  if (params.deckId) {
    filters.push(
      sql`exists (select 1 from ${deckWords} dw where dw.word_id = ${words.id} and dw.deck_id = ${params.deckId})`,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  // Exact hits first, then prefix hits, then everything else — inside each
  // band, the commoner word wins. A learner typing "kit" wants كِتَاب before
  // a rare word that merely contains those letters.
  const rank = normalized
    ? sql<number>`case
        when ${words.arabicPlain} = ${normalized} then 0
        when ${words.arabicPlain} like ${`${normalized}%`} then 1
        when ${words.searchBlob} like ${`${normalized}%`} then 2
        else 3 end`
    : null;

  // With no search term there is nothing to rank by, and a literal in ORDER BY
  // would be read as an ordinal column position, not as a value.
  const ordering = [
    ...(rank ? [rank] : []),
    sql`${words.frequencyRank} asc nulls last`,
    asc(words.id),
  ];

  const [rows, totals] = await Promise.all([
    db
      .select(rank ? { ...COLUMNS, rank } : COLUMNS)
      .from(words)
      .where(where)
      .orderBy(...ordering)
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(words)
      .where(where),
  ]);

  const page = rows.slice(0, limit).map((row) => {
    const { rank: _rank, ...word } = row as typeof row & { rank?: number };
    void _rank;
    return word as WordSummary;
  });

  return {
    words: page,
    total: totals[0]?.count ?? 0,
    nextOffset: rows.length > limit ? offset + limit : null,
  };
}

export interface WordDetail extends WordSummary {
  arabicPlain: string;
  rootKey: string | null;
  gender: string | null;
  pluralArabic: string | null;
  pluralType: string | null;
  verbForm: number | null;
  presentTense: string | null;
  masdar: string | null;
  frequencyRank: number | null;
  editorNote: string | null;
  tags: string[];
  examples: {
    id: string;
    arabic: string;
    bengali: string;
    english: string;
    sourceRef: string | null;
    needsReview: boolean;
  }[];
  /** Other words built on the same three letters. The point of a root language. */
  rootFamily: { id: string; arabic: string; transliteration: string; bengaliMeanings: string[] }[];
  decks: { id: string; slug: string; titleBengali: string; titleEnglish: string }[];
}

export async function getWordDetail(id: string): Promise<WordDetail | null> {
  const rows = await db.select().from(words).where(eq(words.id, id)).limit(1);
  const word = rows[0];
  if (!word) return null;

  const [wordExamples, family, memberships] = await Promise.all([
    db
      .select({
        id: examples.id,
        arabic: examples.arabic,
        bengali: examples.bengali,
        english: examples.english,
        sourceRef: examples.sourceRef,
        needsReview: examples.needsReview,
      })
      .from(examples)
      .where(eq(examples.wordId, id))
      .orderBy(asc(examples.orderIndex)),
    word.rootKey
      ? db
          .select({
            id: words.id,
            arabic: words.arabic,
            transliteration: words.transliteration,
            bengaliMeanings: words.bengaliMeanings,
          })
          .from(words)
          .where(and(eq(words.rootKey, word.rootKey), ne(words.id, id)))
          .orderBy(sql`${words.frequencyRank} asc nulls last`)
          .limit(12)
      : Promise.resolve([]),
    db
      .select({
        id: decks.id,
        slug: decks.slug,
        titleBengali: decks.titleBengali,
        titleEnglish: decks.titleEnglish,
      })
      .from(decks)
      .innerJoin(deckWords, eq(deckWords.deckId, decks.id))
      .where(eq(deckWords.wordId, id)),
  ]);

  return {
    id: word.id,
    arabic: word.arabic,
    arabicPlain: word.arabicPlain,
    transliteration: word.transliteration,
    bengaliMeanings: word.bengaliMeanings,
    englishMeanings: word.englishMeanings,
    partOfSpeech: word.partOfSpeech,
    root: word.root,
    rootKey: word.rootKey,
    gender: word.gender,
    pluralArabic: word.pluralArabic,
    pluralType: word.pluralType,
    verbForm: word.verbForm,
    presentTense: word.presentTense,
    masdar: word.masdar,
    frequencyRank: word.frequencyRank,
    audioPath: word.audioPath,
    editorNote: word.editorNote,
    needsReview: word.needsReview,
    tags: word.tags,
    examples: wordExamples,
    rootFamily: family,
    decks: memberships,
  };
}

export interface DeckSummary {
  id: string;
  slug: string;
  titleBengali: string;
  titleEnglish: string;
  descriptionBengali: string;
  descriptionEnglish: string;
  difficulty: string;
  wordCount: number;
}

export async function listDecks(): Promise<DeckSummary[]> {
  return db
    .select({
      id: decks.id,
      slug: decks.slug,
      titleBengali: decks.titleBengali,
      titleEnglish: decks.titleEnglish,
      descriptionBengali: decks.descriptionBengali,
      descriptionEnglish: decks.descriptionEnglish,
      difficulty: decks.difficulty,
      wordCount: sql<number>`(select count(*)::int from ${deckWords} dw where dw.deck_id = ${decks.id})`,
    })
    .from(decks)
    .where(eq(decks.isPublished, true))
    .orderBy(asc(decks.orderIndex));
}
