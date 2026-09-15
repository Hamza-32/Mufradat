/**
 * The canonical origin, for metadata, robots and the sitemap.
 *
 * Checked in order of how much the deployer meant it: an explicit
 * NEXT_PUBLIC_SITE_URL first, then the AUTH_URL the auth layer already needs,
 * then the URL Vercel injects for the current deployment, and finally localhost
 * so a dev build does not produce absolute links to nowhere.
 */
export function siteUrl(): string {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL'] ?? process.env['AUTH_URL'];
  if (explicit) return explicit.replace(/\/$/u, '');

  const vercel = process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? process.env['VERCEL_URL'];
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}
