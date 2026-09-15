/**
 * Audio lives in the repo under public/audio, or on Cloudflare R2's free tier
 * when NEXT_PUBLIC_AUDIO_BASE_URL is set. Never a TTS call at runtime — that is
 * a recurring cost and a dependency on someone else's uptime mid-review.
 */
export function audioUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env['NEXT_PUBLIC_AUDIO_BASE_URL'];
  if (!base) return `/${path.replace(/^\//u, '')}`;
  return `${base.replace(/\/$/u, '')}/${path.replace(/^\//u, '')}`;
}

/**
 * How many decoded clips to hold. Each is a few kilobytes, and a learner works
 * through a deck rather than the dictionary, so a small window covers nearly
 * every repeat press without letting the tab grow without bound.
 */
const CACHE_LIMIT = 48;

/** Keyed by resolved URL; the value is the in-flight or settled object URL. */
const cache = new Map<string, Promise<string>>();

function evictOldest(): void {
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    const stale = cache.get(oldest.value);
    cache.delete(oldest.value);
    void stale?.then(
      (objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      },
      () => {
        /* a failed fetch left nothing to revoke */
      },
    );
  }
}

/**
 * Turn a media URL into something an <audio> element can play from memory.
 *
 * Fetching the bytes and playing a blob: URL rather than pointing the element
 * straight at the .mp3 is deliberate. A download manager extension (IDM, FDM,
 * and friends) watches for media requests made by media elements and hijacks
 * them — the learner gets a "save file?" dialog instead of hearing the word.
 * A blob: URL is local to the page, so there is nothing for it to intercept,
 * and a second press replays from memory rather than going back to the network.
 *
 * If the fetch cannot work — a cross-origin CDN without CORS headers, say — the
 * original URL is handed back, because hearing the word through a clumsy dialog
 * beats not hearing it at all.
 */
export async function playableSrc(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) {
    // Re-insert so the most recently used entry is the last to be evicted.
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  const pending = fetch(url, { credentials: 'omit' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`audio ${String(response.status)}`);
      return URL.createObjectURL(await response.blob());
    })
    .catch(() => url);

  cache.set(url, pending);
  evictOldest();
  return pending;
}
