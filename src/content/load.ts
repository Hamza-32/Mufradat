import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import { deckFileSchema, wordFileSchema, type ContentDeck, type ContentWord } from './schema';

const CONTENT_ROOT = join(process.cwd(), 'content');

export interface ContentBundle {
  words: ContentWord[];
  decks: ContentDeck[];
  /** Human-readable notes: unverified glosses, missing audio, unranked words. */
  warnings: string[];
}

function formatZodError(file: string, error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  return `${file}\n${lines.join('\n')}`;
}

async function listYaml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort();
}

/**
 * Load every content file, validate it, and check the cross-references between
 * decks and words. Throws with every error at once — a content author should
 * not have to fix one typo per run.
 */
export async function loadContent(): Promise<ContentBundle> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const words: ContentWord[] = [];
  const seenWordIds = new Map<string, string>();

  for (const file of await listYaml(join(CONTENT_ROOT, 'words'))) {
    const parsed = wordFileSchema.safeParse(parse(await readFile(file, 'utf8')));
    if (!parsed.success) {
      errors.push(formatZodError(file, parsed.error));
      continue;
    }
    for (const word of parsed.data.words) {
      const previous = seenWordIds.get(word.id);
      if (previous) {
        errors.push(`${file}\n  duplicate word id "${word.id}" (already defined in ${previous})`);
        continue;
      }
      seenWordIds.set(word.id, file);
      words.push(word);
    }
  }

  const decks: ContentDeck[] = [];
  const seenDeckIds = new Map<string, string>();
  const seenSlugs = new Map<string, string>();

  for (const file of await listYaml(join(CONTENT_ROOT, 'decks'))) {
    const parsed = deckFileSchema.safeParse(parse(await readFile(file, 'utf8')));
    if (!parsed.success) {
      errors.push(formatZodError(file, parsed.error));
      continue;
    }
    for (const deck of parsed.data.decks) {
      if (seenDeckIds.has(deck.id)) {
        errors.push(`${file}\n  duplicate deck id "${deck.id}"`);
        continue;
      }
      const slugOwner = seenSlugs.get(deck.slug);
      if (slugOwner) {
        errors.push(`${file}\n  deck slug "${deck.slug}" already used by "${slugOwner}"`);
        continue;
      }
      seenDeckIds.set(deck.id, file);
      seenSlugs.set(deck.slug, deck.id);

      const missing = deck.words.filter((id) => !seenWordIds.has(id));
      if (missing.length > 0) {
        errors.push(`${file}\n  deck "${deck.id}" lists unknown words: ${missing.join(', ')}`);
      }
      const duplicates = deck.words.filter((id, index) => deck.words.indexOf(id) !== index);
      if (duplicates.length > 0) {
        errors.push(
          `${file}\n  deck "${deck.id}" lists a word twice: ${[...new Set(duplicates)].join(', ')}`,
        );
      }
      decks.push(deck);
    }
  }

  const decked = new Set(decks.flatMap((deck) => deck.words));
  const orphans = words.filter((word) => !decked.has(word.id));
  if (orphans.length > 0) {
    warnings.push(
      `${orphans.length} word(s) belong to no deck and no learner will ever see them: ${orphans
        .map((word) => word.id)
        .join(', ')}`,
    );
  }

  const unverified = words.filter(
    (word) => word.needsReview || word.examples.some((example) => example.needsReview),
  );
  if (unverified.length > 0) {
    warnings.push(
      `${unverified.length} item(s) carry needsReview and are flagged in the app for an editor pass: ${unverified
        .map((word) => word.id)
        .join(', ')}`,
    );
  }

  const unranked = words.filter((word) => word.frequencyRank === undefined);
  if (unranked.length > 0) {
    warnings.push(`${unranked.length} word(s) have no frequencyRank and will sort last.`);
  }

  if (errors.length > 0) {
    throw new Error(`Content validation failed:\n\n${errors.join('\n\n')}`);
  }

  return { words, decks, warnings };
}
