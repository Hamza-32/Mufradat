import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The dictionary and the landing page are the whole point of being indexed.
 * Everything behind a session is not: a crawler following /review or /account
 * gets a redirect or an empty queue, and /design is a reviewer's page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account', '/review', '/notes', '/progress', '/design', '/offline'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
