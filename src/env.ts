import { z } from 'zod';

/**
 * Env is validated once, at import time, so a missing variable fails the build
 * or the container start — not the first request in production.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  // Optional on purpose. Guest mode is a full path through this app — no
  // account, no server identity — so an instance with no Google client is a
  // legitimate deployment, not a broken one. When these are absent the provider
  // is not registered and the sign-in page says so, rather than handing the
  // learner to Google for a 401.
  AUTH_GOOGLE_ID: z.string().optional().or(z.literal('')),
  AUTH_GOOGLE_SECRET: z.string().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().or(z.literal('')),
});

const publicSchema = z.object({
  NEXT_PUBLIC_AUDIO_BASE_URL: z.string().optional().or(z.literal('')),
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
