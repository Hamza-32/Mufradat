import { describe, expect, it } from 'vitest';
import { isRetryable, nextDelayMs, shouldRetryNow, MAX_ATTEMPTS_PER_SESSION } from './backoff';

describe('nextDelayMs', () => {
  it('does not wait before the first attempt', () => {
    expect(nextDelayMs(0)).toBe(0);
  });

  it('doubles each time', () => {
    expect(nextDelayMs(1)).toBe(1000);
    expect(nextDelayMs(2)).toBe(2000);
    expect(nextDelayMs(3)).toBe(4000);
  });

  it('caps, so a long offline spell does not schedule a retry hours away', () => {
    expect(nextDelayMs(20)).toBe(60_000);
  });
});

describe('shouldRetryNow', () => {
  it('keeps trying within the session budget', () => {
    expect(shouldRetryNow(0)).toBe(true);
    expect(shouldRetryNow(MAX_ATTEMPTS_PER_SESSION - 1)).toBe(true);
  });

  it('stops in-session retries once the budget is spent', () => {
    expect(shouldRetryNow(MAX_ATTEMPTS_PER_SESSION)).toBe(false);
  });
});

describe('isRetryable', () => {
  it('retries a network failure', () => {
    expect(isRetryable(null)).toBe(true);
  });

  it('retries server errors and rate limits', () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(429)).toBe(true);
  });

  it('keeps an unauthorised answer, because signing in again should not lose it', () => {
    expect(isRetryable(401)).toBe(true);
  });

  it('drops payloads the server will never accept, so they cannot jam the queue', () => {
    expect(isRetryable(422)).toBe(false);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });
});
