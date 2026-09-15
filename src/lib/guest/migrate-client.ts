import { BATCH_LIMITS, type GuestMigrationPayload, type MigrationResult } from './payload';
import { clearGuestData, guestDb, readGuestSettings, summariseGuestData } from './db';

/**
 * Sends a guest's local progress to the account, in batches, and only deletes
 * the local copy once the server has acknowledged the last one.
 *
 * The order matters: cards and logs first, because those are the expensive
 * thing to lose, then games, then notes. If the connection dies halfway, the
 * learner keeps everything locally and the next attempt re-sends — every batch
 * is idempotent, so the re-sent rows land once.
 */

export interface MigrationProgress {
  sent: number;
  total: number;
}

export type MigrationOutcome =
  | { status: 'nothing-to-do' }
  | { status: 'done'; totals: MigrationResult }
  | { status: 'failed'; reason: 'network' | 'unauthorized' | 'server' };

type Batch = Pick<GuestMigrationPayload, 'cards' | 'logs' | 'games' | 'notes'>;

const empty = (): Batch => ({ cards: [], logs: [], games: [], notes: [] });

async function post(body: GuestMigrationPayload): Promise<MigrationResult> {
  const response = await fetch('/api/account/migrate-guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) throw new Error('unauthorized');
  if (!response.ok) throw new Error('server');
  return (await response.json()) as MigrationResult;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function migrateGuestData(
  onProgress?: (progress: MigrationProgress) => void,
): Promise<MigrationOutcome> {
  const db = guestDb();
  const summary = await summariseGuestData();
  if (!db || !summary) return { status: 'nothing-to-do' };

  const [cards, logs, games, notes, settings] = await Promise.all([
    db.cards.toArray(),
    db.logs.toArray(),
    db.games.toArray(),
    db.notes.toArray(),
    readGuestSettings(),
  ]);

  const batches: Batch[] = [
    ...chunk(cards, BATCH_LIMITS.cards).map((part) => ({ ...empty(), cards: part })),
    ...chunk(logs, BATCH_LIMITS.logs).map((part) => ({ ...empty(), logs: part })),
    ...chunk(games, BATCH_LIMITS.games).map((part) => ({ ...empty(), games: part })),
    ...chunk(notes, BATCH_LIMITS.notes).map((part) => ({ ...empty(), notes: part })),
  ];
  // Always send at least one request, so `final` can close the migration even
  // when the guest has only settings to carry over.
  if (batches.length === 0) batches.push(empty());

  const totals: MigrationResult = {
    cardsWritten: 0,
    logsWritten: 0,
    gamesWritten: 0,
    notesWritten: 0,
    cardsKept: 0,
    completed: false,
  };

  try {
    for (const [index, batch] of batches.entries()) {
      const isLast = index === batches.length - 1;
      const result = await post({
        guestId: summary.guestId,
        final: isLast,
        // Settings ride along with the first batch and are ignored if the
        // account already has its own.
        settings: index === 0 ? settings : null,
        ...batch,
      });

      totals.cardsWritten += result.cardsWritten;
      totals.logsWritten += result.logsWritten;
      totals.gamesWritten += result.gamesWritten;
      totals.notesWritten += result.notesWritten;
      totals.cardsKept += result.cardsKept;
      totals.completed ||= result.completed;

      onProgress?.({ sent: index + 1, total: batches.length });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network';
    return {
      status: 'failed',
      reason:
        reason === 'unauthorized' ? 'unauthorized' : reason === 'server' ? 'server' : 'network',
    };
  }

  // Only now, with every batch acknowledged.
  await clearGuestData();
  return { status: 'done', totals };
}
