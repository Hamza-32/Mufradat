import { requireUser, UnauthorizedError } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { deleteNote } from '@/lib/notes/queries';
import { fail, ok, rateLimited, serverError, unauthorized } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

/** `id` here is the note's client id, which is what the editor holds. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    return serverError();
  }

  const limit = await rateLimit('notes', viewer.id);
  if (!limit.success) return rateLimited(limit.retryAfter);

  try {
    // The where clause is scoped to the session's user, so a guessed id from
    // another account deletes nothing and reports nothing.
    const removed = await deleteNote(viewer.id, (await params).id);
    return removed ? ok({ deleted: true }) : fail('not_found', 'No such note', 404);
  } catch (error) {
    console.error('note delete failed', error);
    return serverError();
  }
}
