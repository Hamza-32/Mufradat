import type { NoteRecord, NoteInput } from './queries';

/**
 * The notes UI, like the review session, does not know where notes live. A
 * signed-in learner writes to Postgres; a guest writes to IndexedDB on their
 * own device and the step-4 migration carries those notes into the account on
 * first sign-in.
 */
export interface NotesAdapter {
  list(params: { query?: string; tag?: string; wordId?: string }): Promise<{
    notes: NoteRecord[];
    tags: { tag: string; count: number }[];
  }>;
  save(input: NoteInput): Promise<void>;
  remove(clientId: string): Promise<void>;
}

export function newClientId(): string {
  return globalThis.crypto.randomUUID().replace(/-/gu, '');
}

export function serverNotes(): NotesAdapter {
  return {
    async list(params) {
      const search = new URLSearchParams();
      if (params.query) search.set('q', params.query);
      if (params.tag) search.set('tag', params.tag);
      if (params.wordId) search.set('word', params.wordId);
      const response = await fetch(`/api/notes?${search.toString()}`);
      if (!response.ok) throw new Error('notes');
      return (await response.json()) as {
        notes: NoteRecord[];
        tags: { tag: string; count: number }[];
      };
    },
    async save(input) {
      // A note written on a train is the case this exists for.
      const { postOrQueue } = await import('@/lib/offline/outbox');
      await postOrQueue('/api/notes', 'note', input.clientId, input);
    },
    async remove(clientId) {
      const response = await fetch(`/api/notes/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 404) throw new Error('delete');
    },
  };
}

export function guestNotes(): NotesAdapter {
  async function open() {
    const [{ guestDb, ensureGuestId }, { markGuestData }] = await Promise.all([
      import('@/lib/guest/db'),
      import('@/lib/guest/flag'),
    ]);
    const db = guestDb();
    if (!db) throw new Error('no storage');
    // Establishing the device identity is part of opening the store, so no
    // write path can forget it.
    await ensureGuestId();
    return { db, markGuestData };
  }

  return {
    async list(params) {
      const { db } = await open();
      const rows = await db.notes.toArray();
      const needle = params.query?.trim().toLowerCase() ?? '';

      // Filtering in memory is fine here: a device that holds thousands of
      // guest notes is not a case worth a second index.
      const filtered = rows
        .filter((note) => (params.wordId ? note.wordId === params.wordId : true))
        .filter((note) => (params.tag ? note.tags.includes(params.tag) : true))
        .filter((note) =>
          needle === '' ? true : `${note.title} ${note.body}`.toLowerCase().includes(needle),
        )
        .sort(
          (a, b) =>
            Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt),
        );

      const counts = new Map<string, number>();
      for (const note of rows) {
        for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }

      return {
        notes: filtered.map((note) => ({
          id: note.clientId,
          clientId: note.clientId,
          wordId: note.wordId,
          wordArabic: null,
          title: note.title,
          body: note.body,
          tags: note.tags,
          isPinned: note.isPinned,
          updatedAt: note.updatedAt,
        })),
        tags: [...counts.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      };
    },

    async save(input) {
      const { db, markGuestData } = await open();
      const existing = await db.notes.get(input.clientId);
      const now = new Date().toISOString();
      await db.notes.put({
        clientId: input.clientId,
        wordId: input.wordId,
        title: input.title,
        body: input.body,
        tags: input.tags,
        isPinned: input.isPinned,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      markGuestData();
    },

    async remove(clientId) {
      const { db } = await open();
      // No tombstone needed locally: there is nothing to sync a guest against.
      await db.notes.delete(clientId);
    },
  };
}
