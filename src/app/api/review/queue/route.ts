import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getViewer } from '@/lib/auth/session';
import { getQueue } from '@/lib/review/server';
import { invalid, ok, serverError, unauthorized } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

const schema = z.object({ deck: z.string().max(64).optional(), pool: z.enum(['1']).optional() });

export async function GET(request: NextRequest): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();

  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return invalid(parsed.error);

  try {
    return ok(await getQueue(viewer.id, parsed.data.deck, { pool: parsed.data.pool === '1' }));
  } catch (error) {
    console.error('queue build failed', error);
    return serverError();
  }
}
