import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The service worker exists for one scenario: a learner on a Dhaka bus with two
 * bars of signal who wants to do their reviews. Everything below follows from
 * that.
 *
 * Note what is *not* cached. Auth routes and every mutating endpoint are
 * network-only — serving a stale session or replaying a POST from a cache would
 * be worse than failing. Writes that cannot reach the server are handled by the
 * outbox in IndexedDB, not here, because a queued review has to survive the
 * service worker being replaced.
 */
const serwist = new Serwist({
  // The manifest is injected at build time; an empty list is the honest
  // default when the worker is built without one.
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Never cache anything to do with identity.
      matcher: ({ url }) => url.pathname.startsWith('/api/auth'),
      handler: new NetworkOnly(),
    },
    {
      // Writes are the outbox's business, not the cache's.
      matcher: ({ request, url }) =>
        request.method !== 'GET' || url.pathname.startsWith('/api/notes'),
      handler: new NetworkOnly(),
    },
    {
      // Today's queue: fresh when there is a network, yesterday's copy when
      // there is not. A slightly stale queue is a study session; no queue is a
      // wasted journey.
      matcher: ({ url }) =>
        url.pathname === '/api/review/queue' || url.pathname === '/api/review/candidates',
      handler: new NetworkFirst({
        cacheName: 'mufradat-queue',
        networkTimeoutSeconds: 4,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => (response.status === 200 ? response : null),
          },
        ],
      }),
    },
    {
      // Dictionary lookups change rarely; show the cached answer immediately
      // and refresh behind it.
      matcher: ({ url }) => url.pathname === '/api/words',
      handler: new StaleWhileRevalidate({ cacheName: 'mufradat-words' }),
    },
    {
      // Pronunciation files are immutable once published.
      matcher: ({ url }) => url.pathname.startsWith('/audio/'),
      handler: new StaleWhileRevalidate({ cacheName: 'mufradat-audio' }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
