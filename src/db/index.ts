import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * postgres.js rather than a provider-specific driver: the same code runs on
 * Vercel (against a pooled Neon/Supabase URL) and in a container on
 * Railway/Render. No Vercel-only primitives in business logic.
 */
declare global {
  var __mufradatSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');
  return postgres(url, {
    // Serverless invocations are short-lived; keep the pool tiny.
    max: process.env['NODE_ENV'] === 'production' ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required when going through a transaction pooler
  });
}

const client = globalThis.__mufradatSql ?? createClient();
if (process.env['NODE_ENV'] !== 'production') globalThis.__mufradatSql = client;

export const db = drizzle(client, { schema, casing: 'snake_case' });
export { schema };
export type Db = typeof db;
