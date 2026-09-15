import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * Liveness for the container healthcheck and for uptime monitoring. It touches
 * the database, because a process that is running but cannot reach Postgres is
 * not healthy — it just looks it.
 */
export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
