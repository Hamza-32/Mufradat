import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * These assertions are about a deployment dashboard, not about TypeScript.
 *
 * Vercel's project settings hand you a row per variable, and the natural way to
 * say "I am not using Upstash" is to leave the value empty. That arrives in the
 * process as '' rather than as undefined, and a `z.string().url().optional()`
 * rejects '' — so the build goes green and the first request 500s. The schema
 * treats blank as absent to close that gap; this is the test that says so.
 */
const blankAsAbsent = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

describe('optional environment variables', () => {
  const optionalUrl = blankAsAbsent(z.string().url());
  const optionalText = blankAsAbsent(z.string());

  it('accepts a variable that is absent', () => {
    expect(optionalUrl.safeParse(undefined).success).toBe(true);
    expect(optionalText.safeParse(undefined).success).toBe(true);
  });

  it('accepts a variable left blank in a dashboard', () => {
    expect(optionalUrl.safeParse('').success).toBe(true);
    expect(optionalText.safeParse('').success).toBe(true);
  });

  it('reads a blank as absent rather than as an empty value', () => {
    expect(optionalUrl.parse('')).toBeUndefined();
    expect(optionalText.parse('')).toBeUndefined();
  });

  it('still rejects a value that is present and malformed', () => {
    expect(optionalUrl.safeParse('not-a-url').success).toBe(false);
  });

  it('accepts a real value', () => {
    expect(optionalUrl.parse('https://example.upstash.io')).toBe('https://example.upstash.io');
  });
});
