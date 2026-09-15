/**
 * Runs committed SQL migrations. Uses the unpooled URL when one is present:
 * migrations need a real session, not a transaction pooler.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    console.log('✓ migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
