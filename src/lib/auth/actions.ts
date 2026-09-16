'use server';

import { signOut } from '@/auth';

/**
 * Ending a session, in its own module so a client component can reach it.
 *
 * The sidebar is a client component — it reads the pathname to mark the active
 * link — so it cannot declare an inline server action the way a page can. This
 * is that action, exported once and shared by the sidebar and the account page
 * rather than written twice.
 */
export async function endSession(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
