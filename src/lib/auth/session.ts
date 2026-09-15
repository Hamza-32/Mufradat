import { auth } from '@/auth';

export interface Viewer {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

/**
 * The single source of a user id. Route handlers call `requireUser()`; nothing
 * in the app reads a user id from a request body, a query string or a header.
 * A client-supplied id is treated as data about what the client wants, never
 * as a claim about who they are.
 */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'UnauthorizedError';
  }
}

export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthorizedError();
  return viewer;
}
