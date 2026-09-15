import Dexie, { type EntityTable } from 'dexie';
import type { GuestCard, GuestGame, GuestLog, GuestNote, GuestSettings } from './payload';
import { clearGuestDataFlag, markGuestData } from './flag';

/**
 * A guest's progress, on their device only.
 *
 * Guest mode is not a degraded account: it is a full local one. Nothing is sent
 * anywhere until the learner signs in and the migration runs, and the local
 * copy is not deleted until the server has confirmed every batch.
 *
 * The same database becomes the offline queue in step 10 — a signed-in learner
 * on a dead connection writes here too, which is why the rows already carry the
 * client-generated ids the server dedupes on.
 */

export interface GuestMeta {
  key: 'guestId' | 'createdAt' | 'migratedAt';
  value: string;
}

/**
 * The outbox: writes a signed-in learner made while the network was gone.
 *
 * Guests need none of this — their data is already local and authoritative.
 * This is only for someone with an account who graded a card on a train.
 */
export interface OutboxItem {
  /** The same idempotency key the request body carries. */
  clientEventId: string;
  kind: 'grade' | 'game' | 'note';
  url: string;
  payload: unknown;
  queuedAt: string;
  attempts: number;
}

class GuestDatabase extends Dexie {
  meta!: EntityTable<GuestMeta, 'key'>;
  cards!: EntityTable<GuestCard, 'wordId'>;
  logs!: EntityTable<GuestLog, 'clientEventId'>;
  games!: EntityTable<GuestGame, 'clientEventId'>;
  notes!: EntityTable<GuestNote, 'clientId'>;
  settings!: EntityTable<GuestSettings & { id: 'local' }, 'id'>;
  outbox!: EntityTable<OutboxItem, 'clientEventId'>;

  constructor() {
    super('mufradat-guest');
    this.version(1).stores({
      meta: 'key',
      cards: 'wordId, due, state, deckId',
      logs: 'clientEventId, reviewedAt, localDate, wordId',
      games: 'clientEventId, startedAt, localDate',
      notes: 'clientId, updatedAt, wordId',
      settings: 'id',
    });
    // v2 adds the outbox. Dexie migrates in place; nothing already stored moves.
    this.version(2).stores({
      meta: 'key',
      cards: 'wordId, due, state, deckId',
      logs: 'clientEventId, reviewedAt, localDate, wordId',
      games: 'clientEventId, startedAt, localDate',
      notes: 'clientId, updatedAt, wordId',
      settings: 'id',
      outbox: 'clientEventId, queuedAt, kind',
    });
  }
}

let instance: GuestDatabase | null = null;

/** Null on the server, where IndexedDB does not exist. */
export function guestDb(): GuestDatabase | null {
  if (typeof window === 'undefined') return null;
  instance ??= new GuestDatabase();
  return instance;
}

function randomId(): string {
  return globalThis.crypto.randomUUID().replace(/-/gu, '');
}

/**
 * Stable per device, created the first time anything is written.
 *
 * This must be called by every guest write path. Without an id there is nothing
 * to migrate against, and `summariseGuestData` below would report an empty
 * device even with a hundred reviews stored — silently discarding exactly the
 * progress the migration exists to protect.
 */
export async function ensureGuestId(): Promise<string | null> {
  const db = guestDb();
  if (!db) return null;
  const existing = await db.meta.get('guestId');
  if (existing) return existing.value;

  const guestId = randomId();
  markGuestData();
  await db.meta.bulkPut([
    { key: 'guestId', value: guestId },
    { key: 'createdAt', value: new Date().toISOString() },
  ]);
  return guestId;
}

export interface GuestSummary {
  guestId: string;
  cards: number;
  logs: number;
  games: number;
  notes: number;
  total: number;
}

/**
 * Is there anything worth migrating? Called on every sign-in, so it counts
 * rather than reads: a learner with 4,000 reviews should not load them all to
 * answer a yes/no question.
 */
export async function summariseGuestData(): Promise<GuestSummary | null> {
  const db = guestDb();
  if (!db) return null;
  const [cards, logs, games, notes] = await Promise.all([
    db.cards.count(),
    db.logs.count(),
    db.games.count(),
    db.notes.count(),
  ]);

  const total = cards + logs + games + notes;
  if (total === 0) return null;

  // Belt and braces: if data exists without an id — an interrupted first write,
  // or a database from an older build — mint one rather than report nothing.
  const guestId = await ensureGuestId();
  if (!guestId) return null;

  return { guestId, cards, logs, games, notes, total };
}

export async function readGuestSettings(): Promise<GuestSettings | null> {
  const db = guestDb();
  if (!db) return null;
  const row = await db.settings.get('local');
  if (!row) return null;
  const { id, ...settings } = row;
  void id;
  return settings;
}

/**
 * Delete the local copy. Called only after the server has acknowledged the
 * final batch — losing a learner's work to a half-finished sync is the one
 * failure this whole flow exists to prevent.
 */
export async function clearGuestData(): Promise<void> {
  const db = guestDb();
  if (!db) return;
  await db.transaction(
    'rw',
    [db.cards, db.logs, db.games, db.notes, db.settings, db.meta],
    async () => {
      // The outbox is deliberately not cleared here: it belongs to the account,
      // not to the guest identity being retired.
      await Promise.all([
        db.cards.clear(),
        db.logs.clear(),
        db.games.clear(),
        db.notes.clear(),
        db.settings.clear(),
      ]);
      await db.meta.put({ key: 'migratedAt', value: new Date().toISOString() });
    },
  );
  clearGuestDataFlag();
}
