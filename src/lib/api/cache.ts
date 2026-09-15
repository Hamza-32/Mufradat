/**
 * Cache policy for the public content routes.
 *
 * The dictionary is the same bytes for every caller and only changes when the
 * content is reseeded, so it belongs in a CDN rather than in a database query
 * per request. `s-maxage` is what a shared cache honours; `max-age=0` keeps the
 * browser asking, so a reseed shows up without anyone hard-refreshing.
 * `stale-while-revalidate` means a cold cache never makes a learner wait.
 */
export const CONTENT_CACHE_CONTROL =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';
