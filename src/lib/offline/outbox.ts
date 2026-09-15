import { isRetryable, nextDelayMs, shouldRetryNow } from './backoff';
import type { OutboxItem } from '@/lib/guest/db';

/**
 * Writes a signed-in learner made while the network was gone.
 *
 * Every write in this app already carries a client-generated idempotency key —
 * that was decided in step 1, before there was an offline mode, precisely so
 * this queue could be dumb. Flushing the same item twice is harmless, so the
 * queue never has to reason about whether a request "really" went through
 * before the connection dropped.
 *
 * Nothing is removed from the queue until the server has answered. A review
 * graded on a train survives a closed tab, a dead battery, and a week offline.
 */

const CHANGED = 'mufradat:outbox-changed';

async function store() {
  const { guestDb } = await import('@/lib/guest/db');
  return guestDb();
}

function announce(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
}

export function onOutboxChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(CHANGED, listener);
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export async function pendingCount(): Promise<number> {
  const db = await store();
  return db ? db.outbox.count() : 0;
}

async function enqueue(item: Omit<OutboxItem, 'queuedAt' | 'attempts'>): Promise<void> {
  const db = await store();
  if (!db) return;
  const existing = await db.outbox.get(item.clientEventId);
  await db.outbox.put({
    ...item,
    queuedAt: existing?.queuedAt ?? new Date().toISOString(),
    attempts: existing?.attempts ?? 0,
  });
  announce();
}

/**
 * POST an item. Returns whether it can leave the queue — which is true both
 * when the server accepted it and when the server will never accept it, since
 * an unacceptable payload retried forever would block every review behind it.
 */
async function send(item: OutboxItem): Promise<{ done: boolean; retry: boolean }> {
  try {
    const response = await fetch(item.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.payload),
    });
    if (response.ok) return { done: true, retry: false };
    if (!isRetryable(response.status)) {
      console.warn('outbox: dropping an item the server will not accept', {
        kind: item.kind,
        status: response.status,
      });
      return { done: true, retry: false };
    }
    return { done: false, retry: true };
  } catch {
    // Offline, or the request never left the device.
    return { done: false, retry: true };
  }
}

let flushing = false;

/**
 * Send everything, oldest first, so a session replays in the order it was
 * actually studied — FSRS state depends on the order of the grades.
 */
export async function flushOutbox(): Promise<{ sent: number; remaining: number }> {
  if (flushing) return { sent: 0, remaining: await pendingCount() };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, remaining: await pendingCount() };
  }

  const db = await store();
  if (!db) return { sent: 0, remaining: 0 };

  flushing = true;
  let sent = 0;

  try {
    const items = await db.outbox.orderBy('queuedAt').toArray();
    for (const item of items) {
      if (!shouldRetryNow(item.attempts)) continue;

      const result = await send(item);
      if (result.done) {
        await db.outbox.delete(item.clientEventId);
        sent += 1;
        continue;
      }

      await db.outbox.update(item.clientEventId, { attempts: item.attempts + 1 });
      // One failure usually means the connection is gone, so stop rather than
      // marching the whole queue through the same timeout.
      break;
    }
  } finally {
    flushing = false;
    announce();
  }

  const remaining = await db.outbox.count();
  if (remaining > 0 && typeof window !== 'undefined') {
    const worst = await db.outbox.orderBy('queuedAt').first();
    const delay = nextDelayMs(worst?.attempts ?? 1);
    if (delay > 0 && shouldRetryNow(worst?.attempts ?? 0)) {
      setTimeout(() => {
        void flushOutbox();
      }, delay);
    }
  }

  return { sent, remaining };
}

/**
 * Post now if possible, queue if not. This is the only path the app uses for a
 * write it must not lose — a failure is never surfaced as "try again", because
 * the answer is already safe on the device.
 */
export async function postOrQueue(
  url: string,
  kind: OutboxItem['kind'],
  clientEventId: string,
  payload: unknown,
): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueue({ url, kind, clientEventId, payload });
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return;
    if (!isRetryable(response.status)) return;
  } catch {
    // fall through to the queue
  }

  await enqueue({ url, kind, clientEventId, payload });
  void flushOutbox();
}
