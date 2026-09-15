import { z } from 'zod';

/**
 * A variable left blank in a deployment dashboard arrives as an empty string,
 * not as absent, and "blank" is how a deployer says "I am not using this". So
 * the two are treated the same here — otherwise leaving an optional row empty
 * in Vercel fails validation on the first request, long after the build has
 * gone green, which is a miserable thing to debug.
 */
const blankAsAbsent = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Env is validated once, at import time, so a missing variable fails the build
 * or the container start — not the first request in production.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: blankAsAbsent(z.string().url()),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: blankAsAbsent(z.string().url()),
  // Optional on purpose. Guest mode is a full path through this app — no
  // account, no server identity — so an instance with no Google client is a
  // legitimate deployment, not a broken one. When these are absent the provider
  // is not registered and the sign-in page says so, rather than handing the
  // learner to Google for a 401.
  AUTH_GOOGLE_ID: blankAsAbsent(z.string()),
  AUTH_GOOGLE_SECRET: blankAsAbsent(z.string()),
  UPSTASH_REDIS_REST_URL: blankAsAbsent(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: blankAsAbsent(z.string()),
});

const publicSchema = z.object({
  NEXT_PUBLIC_AUDIO_BASE_URL: blankAsAbsent(z.string()),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

let cached: (ServerEnv & PublicEnv) | undefined;

export function env(): ServerEnv & PublicEnv {
  if (cached) return cached;
  const parsed = serverSchema.merge(publicSchema).safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
