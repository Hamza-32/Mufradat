/**
 * Validates every content file without touching the database, so CI can catch
 * a broken gloss on a pull request. Run: npm run content:check
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../src/content/load';

async function main(): Promise<void> {
  const { words, decks, warnings } = await loadContent();

  const audioMissing = words.filter((word) => !word.audio).length;
  // A declared path with no file behind it is worse than no path at all: the
  // card renders an enabled play button that dies on the first press. Only the
  // repo copy is checked — an R2 mirror is built from exactly these files.
  const audioBroken = words
    .filter((word) => word.audio && !existsSync(join(process.cwd(), 'public', word.audio)))
    .map((word) => word.id);

  console.log(`✓ ${words.length} words, ${decks.length} decks validated`);
  for (const deck of decks) {
    console.log(`  ${deck.slug.padEnd(24)} ${String(deck.words.length).padStart(4)} words`);
  }
  if (audioMissing > 0) {
    console.log(`  note: ${audioMissing} word(s) declare no audio path`);
  }
  if (audioBroken.length > 0) {
    console.log(
      `! ${audioBroken.length} word(s) declare audio that is not in public/audio — ` +
        `run \`npm run audio\`: ${audioBroken.slice(0, 12).join(', ')}` +
        (audioBroken.length > 12 ? ', …' : ''),
    );
  }
  for (const warning of warnings) {
    console.log(`! ${warning}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
