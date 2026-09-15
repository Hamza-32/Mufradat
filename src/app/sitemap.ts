import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { listDecks, searchWords } from '@/lib/words/queries';

/**
 * Built at request time, not at build time: the word list comes from the
 * database, and a deploy must not fail because Postgres was briefly out of
 * reach. For the same reason a query failure degrades to the static routes
 * rather than throwing — a partial sitemap beats a 500.
 */
export const dynamic = 'force-dynamic';

/** Every word, in pages, so the sitemap covers the whole dictionary. */
const PAGE = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/words`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/games`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/signin`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const decks = await listDecks();
    const deckRoutes: MetadataRoute.Sitemap = decks.map((deck) => ({
      url: `${base}/words?deck=${deck.id}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    const words: MetadataRoute.Sitemap = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await searchWords({ limit: PAGE, offset });
      for (const word of page.words) {
        words.push({
          url: `${base}/words/${word.id}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
      if (page.nextOffset === null) break;
    }

    return [...staticRoutes, ...deckRoutes, ...words];
  } catch (error) {
    console.error('sitemap: word list unavailable', error);
    return staticRoutes;
  }
}
