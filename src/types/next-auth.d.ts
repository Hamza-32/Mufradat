import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /** Set in the session callback from the adapter user, never from input. */
      id: string;
    } & DefaultSession['user'];
  }
}
