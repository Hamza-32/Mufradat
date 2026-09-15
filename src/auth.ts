import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { accounts, sessions, streaks, userSettings, users, verificationTokens } from '@/db/schema';

/**
 * Google only in v1, plus a guest mode that never touches this file — a guest
 * has no server identity at all, which is the point: no account, no row, no
 * data leaving the phone until they choose to sign in.
 *
 * Database sessions rather than JWTs. The session cookie then carries nothing
 * but an opaque token, so "delete my account" genuinely ends every session
 * instead of leaving signed tokens valid until they expire.
 */
/**
 * Whether a usable Google OAuth client is configured. A placeholder id sends the
 * learner to Google's "OAuth client was not found" page, which reads as the app
 * being broken, so every entry point checks this first.
 */
export function googleConfigured(): boolean {
  return Boolean(process.env['AUTH_GOOGLE_ID'] && process.env['AUTH_GOOGLE_SECRET']);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: googleConfigured() ? [Google] : [],
  session: { strategy: 'database', maxAge: 60 * 60 * 24 * 90 },
  pages: { signIn: '/signin', error: '/signin' },
  callbacks: {
    session({ session, user }) {
      // The only place a user id is ever established. Nothing downstream may
      // accept an id from the client.
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Give every new account its defaults up front, so no later code has to
      // handle "settings row might not exist yet".
      await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
      await db.insert(streaks).values({ userId: user.id }).onConflictDoNothing();
    },
  },
});
