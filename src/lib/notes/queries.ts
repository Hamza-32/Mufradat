import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { notes, words } from '@/db/schema';
import { normalizeQuery } from '@/lib/arabic/normalize';

export interface NoteRecord {
  id: string;
  clientId: string | null;
  wordId: string | null;
  wordArabic: string | null;
  title: string;
  body: string;
  tags: string[];
  isPinned: boolean;
  updatedAt: string;
}

export interface NoteListParams {
  query?: string | undefined;
  tag?: string | undefined;
  wordId?: string | undefined;
}

const SELECT = {
  id: notes.id,
  clientId: notes.clientId,
  wordId: notes.wordId,
  wordArabic: words.arabic,
  title: notes.title,
  body: notes.body,
  tags: notes.tags,
  isPinned: notes.isPinned,
  updatedAt: notes.updatedAt,
};

/**
 * Pinned notes first, then most recently edited. Search runs over title and
 * body together with the same trigram index the schema declares — and Arabic in
 * the query is normalised first, so a note written with full tashkeel is found
 * by someone typing the bare letters.
 */
export async function listNotes(
  userId: string,
  params: NoteListParams = {},
): Promise<NoteRecord[]> {
  const filters: SQL[] = [eq(notes.userId, userId), isNull(notes.deletedAt)];

  if (params.query?.trim()) {
    const { script, value } = normalizeQuery(params.query.trim());
    const like = `%${value}%`;
    // Arabic is matched twice: once as typed, once normalised, because the note
    // body is stored exactly as the learner wrote it.
    filters.push(
      script === 'arabic'
        ? (sql`(coalesce(${notes.title}, '') || ' ' || coalesce(${notes.body}, '')) like ${`%${params.query.trim()}%`}
             or (coalesce(${notes.title}, '') || ' ' || coalesce(${notes.body}, '')) like ${like}` as SQL)
        : (sql`(coalesce(${notes.title}, '') || ' ' || coalesce(${notes.body}, '')) ilike ${like}` as SQL),
    );
  }

  if (params.tag) {
    filters.push(sql`${notes.tags} @> ${JSON.stringify([params.tag])}::jsonb`);
  }
  if (params.wordId) {
    filters.push(eq(notes.wordId, params.wordId));
  }

  const rows = await db
    .select(SELECT)
    .from(notes)
    .leftJoin(words, eq(words.id, notes.wordId))
    .where(and(...filters))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
    .limit(200);

  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export interface NoteInput {
  clientId: string;
  wordId: string | null;
  title: string;
  body: string;
  tags: string[];
  isPinned: boolean;
}

/**
 * Upsert by the note's own client id. The editor saves as the learner types, so
 * this runs often; keying on a client-generated id means those saves collapse
 * into one row instead of racing to create several.
 */
export async function saveNote(userId: string, input: NoteInput): Promise<NoteRecord> {
  const now = new Date();
  const [row] = await db
    .insert(notes)
    .values({
      userId,
      clientId: input.clientId,
      wordId: input.wordId,
      title: input.title,
      body: input.body,
      tags: input.tags,
      isPinned: input.isPinned,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.clientId],
      set: {
        wordId: input.wordId,
        title: input.title,
        body: input.body,
        tags: input.tags,
        isPinned: input.isPinned,
        updatedAt: now,
        // Editing a note the learner had deleted brings it back rather than
        // failing on a row they can no longer see.
        deletedAt: null,
      },
    })
    .returning(SELECT);

  return { ...row!, wordArabic: null, updatedAt: row!.updatedAt.toISOString() };
}

/**
 * Soft delete. The row stays so that a note deleted on one device does not
 * reappear when an older device syncs — step 10 needs that tombstone.
 */
export async function deleteNote(userId: string, clientId: string): Promise<boolean> {
  const deleted = await db
    .update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.userId, userId), eq(notes.clientId, clientId), isNull(notes.deletedAt)))
    .returning({ id: notes.id });
  return deleted.length > 0;
}

/** Every tag the learner has used, commonest first, for the filter row. */
export async function listTags(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await db.execute<{ tag: string; count: number }>(sql`
    select tag, count(*)::int as count
    from ${notes}, jsonb_array_elements_text(${notes.tags}) as tag
    where ${notes.userId} = ${userId} and ${notes.deletedAt} is null
    group by tag
    order by count desc, tag asc
    limit 40
  `);
  return [...rows];
}
