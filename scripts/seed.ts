/**
 * Idempotent content seed. Safe to run on every deploy.
 *
 *   npm run db:seed              # upsert everything
 *   npm run db:seed -- --prune   # also delete rows no longer in the YAML
 *
 * Learner data is never touched. Words and decks are upserted by their
 * content-defined ids, so re-seeding a corrected gloss updates the existing row
 * and every learner's review history for that word survives.
 */
import 'dotenv/config';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { buildSearchBlob, normalizeArabic, normalizeRoot } from '../src/lib/arabic/normalize';
import { loadContent } from '../src/content/load';
import type { ContentWord } from '../src/content/schema';
import * as schema from '../src/db/schema';
import { deckWords, decks, examples, words } from '../src/db/schema';

const prune = process.argv.includes('--prune');

function toWordRow(word: ContentWord): typeof words.$inferInsert {
  const needsReview = word.needsReview || word.examples.some((example) => example.needsReview);

  return {
    id: word.id,
    arabic: word.arabic,
    arabicPlain: normalizeArabic(word.arabic),
    transliteration: word.transliteration,
    bengaliMeanings: word.bn,
    englishMeanings: word.en,
    partOfSpeech: word.pos,
    root: word.root ?? null,
    rootKey: word.root ? normalizeRoot(word.root) : null,
    gender: word.gender ?? null,
    pluralArabic: word.plural?.arabic ?? null,
    pluralPlain: word.plural ? normalizeArabic(word.plural.arabic) : null,
    pluralType: word.plural?.type ?? null,
    verbForm: word.verb?.form ?? null,
    presentTense: word.verb?.present ?? null,
    masdar: word.verb?.masdar ?? null,
    frequencyRank: word.frequencyRank ?? null,
    audioPath: word.audio ?? null,
    editorNote: word.editorNote ?? null,
    needsReview,
    tags: word.tags,
    searchBlob: buildSearchBlob({
      arabic: word.arabic,
      transliteration: word.transliteration,
      bengali: word.bn,
      english: word.en,
      root: word.root ?? null,
      tags: word.tags,
    }),
    updatedAt: new Date(),
  };
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');

  const bundle = await loadContent();
  for (const warning of bundle.warnings) console.log(`! ${warning}`);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  try {
    await db.transaction(async (tx) => {
      // --- words -----------------------------------------------------------
      const wordRows = bundle.words.map(toWordRow);
      for (const row of wordRows) {
        await tx
          .insert(words)
          .values(row)
          .onConflictDoUpdate({
            target: words.id,
            set: {
              arabic: row.arabic,
              arabicPlain: row.arabicPlain,
              transliteration: row.transliteration,
              bengaliMeanings: row.bengaliMeanings,
              englishMeanings: row.englishMeanings,
              partOfSpeech: row.partOfSpeech,
              root: row.root ?? null,
              rootKey: row.rootKey ?? null,
              gender: row.gender ?? null,
              pluralArabic: row.pluralArabic ?? null,
              pluralPlain: row.pluralPlain ?? null,
              pluralType: row.pluralType ?? null,
              verbForm: row.verbForm ?? null,
              presentTense: row.presentTense ?? null,
              masdar: row.masdar ?? null,
              frequencyRank: row.frequencyRank ?? null,
              audioPath: row.audioPath ?? null,
              editorNote: row.editorNote ?? null,
              needsReview: row.needsReview ?? false,
              tags: row.tags,
              searchBlob: row.searchBlob,
              updatedAt: new Date(),
            },
          });
      }

      // --- examples --------------------------------------------------------
      // Examples have no natural key, so they are replaced per word. Nothing
      // user-generated hangs off them.
      const wordIds = bundle.words.map((word) => word.id);
      if (wordIds.length > 0) {
        await tx.delete(examples).where(inArray(examples.wordId, wordIds));
      }
      const exampleRows = bundle.words.flatMap((word) =>
        word.examples.map((example, index) => ({
          wordId: word.id,
          arabic: example.arabic,
          arabicPlain: normalizeArabic(example.arabic),
          bengali: example.bn,
          english: example.en,
          sourceRef: example.source ?? null,
          needsReview: example.needsReview,
          orderIndex: index,
        })),
      );
      if (exampleRows.length > 0) {
        await tx.insert(examples).values(exampleRows);
      }

      // --- decks -----------------------------------------------------------
      for (const deck of bundle.decks) {
        const row = {
          id: deck.id,
          slug: deck.slug,
          titleBengali: deck.title.bn,
          titleEnglish: deck.title.en,
          descriptionBengali: deck.description.bn,
          descriptionEnglish: deck.description.en,
          difficulty: deck.difficulty,
          defaultCardDirection: deck.defaultCardDirection,
          orderIndex: deck.order,
          isPublished: deck.published,
          updatedAt: new Date(),
        } satisfies typeof decks.$inferInsert;

        await tx
          .insert(decks)
          .values(row)
          .onConflictDoUpdate({ target: decks.id, set: { ...row } });

        // Deck membership is replaced wholesale: order changes are common and
        // a removed word should leave the deck. Learner cards are untouched.
        await tx.delete(deckWords).where(eq(deckWords.deckId, deck.id));
        await tx.insert(deckWords).values(
          deck.words.map((wordId, index) => ({
            deckId: deck.id,
            wordId,
            orderIndex: index,
          })),
        );
      }

      // --- prune -----------------------------------------------------------
      if (prune) {
        const deckIds = bundle.decks.map((deck) => deck.id);
        const removedDecks = await tx
          .delete(decks)
          .where(deckIds.length > 0 ? notInArray(decks.id, deckIds) : sql`true`)
          .returning({ id: decks.id });
        const removedWords = await tx
          .delete(words)
          .where(wordIds.length > 0 ? notInArray(words.id, wordIds) : sql`true`)
          .returning({ id: words.id });
        if (removedDecks.length > 0) {
          console.log(`- removed decks: ${removedDecks.map((deck) => deck.id).join(', ')}`);
        }
        if (removedWords.length > 0) {
          console.log(
            `- removed words (and their review history): ${removedWords
              .map((word) => word.id)
              .join(', ')}`,
          );
        }
      }

      console.log(
        `✓ seeded ${wordRows.length} words, ${exampleRows.length} examples, ${bundle.decks.length} decks`,
      );
      const flagged = wordRows.filter((row) => row.needsReview).length;
      if (flagged > 0) {
        console.log(`  ${flagged} word(s) flagged needsReview — shown with an editor badge in-app`);
      }
    });
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
