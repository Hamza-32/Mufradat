/**
 * Retry policy for the offline outbox.
 *
 * A learner on patchy mobile data will hit a failed request several times in a
 * session. Retrying immediately and forever burns their battery and their data
 * allowance, so the queue backs off — but it never gives up on a review, only
 * on a single attempt. The row stays until the server has acknowledged it.
 */

/** Attempts after which an item is left for the next app start rather than retried in-session. */
export const MAX_ATTEMPTS_PER_SESSION = 6;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

/** Exponential, capped. Deterministic — jitter is added by the caller if needed. */
export function nextDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempts - 1));
}

export function shouldRetryNow(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS_PER_SESSION;
}

/**
 * Which failures are worth retrying at all.
 *
 * A 422 means the payload is malformed: sending it again produces the same 422
 * forever, so it is dropped with a log rather than jamming the queue ahead of
 * reviews that would succeed. A 401 is kept — the learner may simply need to
 * sign in again, and their answers should survive that.
 */
export function isRetryable(status: number | null): boolean {
  if (status === null) return true; // network failure
  if (status === 422 || status === 400 || status === 404) return false;
  if (status === 409) return false; // already recorded
  return true;
}
