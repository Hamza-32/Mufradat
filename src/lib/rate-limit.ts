import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Every mutating route is rate limited. Upstash's free tier in production; an
 * in-process limiter in development and in CI, so nobody needs credentials to
 * run the app — and so a missing env var degrades to "still limited" rather
 * than "not limited at all".
 *
 * Buckets are named because they have genuinely different shapes: grading a
 * card happens many times a minute, migrating a guest account happens once.
 */
export type Bucket = 'review' | 'notes' | 'games' | 'migration' | 'account';

const LIMITS: Record<Bucket, { tokens: number; window: `${number} ${'s' | 'm' | 'h'}` }> = {
  review: { tokens: 240, window: '1 m' },
  notes: { tokens: 60, window: '1 m' },
  games: { tokens: 60, window: '1 m' },
  migration: { tokens: 20, window: '1 h' },
  account: { tokens: 10, window: '1 h' },
};

export interface LimitResult {
  success: boolean;
  /** Seconds until the caller may retry. Zero when the request was allowed. */
  retryAfter: number;
}

function upstash(): Redis | null {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = upstash();
const limiters = new Map<Bucket, Ratelimit>();

/** Fallback: fixed window per key, in memory. Enough for one process. */
const local = new Map<string, { count: number; resetAt: number }>();

function localLimit(bucket: Bucket, key: string): LimitResult {
  const { tokens, window } = LIMITS[bucket];
  const [amount, unit] = window.split(' ') as [string, 's' | 'm' | 'h'];
  const ms = Number(amount) * (unit === 's' ? 1000 : unit === 'm' ? 60_000 : 3_600_000);
  const now = Date.now();
  const entry = local.get(key);

  if (!entry || entry.resetAt <= now) {
    local.set(key, { count: 1, resetAt: now + ms });
    return { success: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > tokens) {
    return { success: false, retryAfter: (entry.resetAt - now) / 1000 };
  }
  return { success: true, retryAfter: 0 };
}

/**
 * @param identifier Always a server-established value — a session user id, or
 * the request IP for unauthenticated routes. Never a client-supplied id.
 */
export async function rateLimit(bucket: Bucket, identifier: string): Promise<LimitResult> {
  const key = `${bucket}:${identifier}`;
  if (!redis) return localLimit(bucket, key);

  let limiter = limiters.get(bucket);
  if (!limiter) {
    const { tokens, window } = LIMITS[bucket];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `mufradat:${bucket}`,
      analytics: false,
    });
    limiters.set(bucket, limiter);
  }

  const result = await limiter.limit(key);
  return {
    success: result.success,
    retryAfter: result.success ? 0 : Math.max(0, (result.reset - Date.now()) / 1000),
  };
}
