import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // A service worker in development caches the thing you just changed.
  disable: process.env['NODE_ENV'] === 'development',
  reloadOnOnline: false,
});

/**
 * Sent on every response.
 *
 * The CSP here is deliberately the half that needs no nonce: `frame-ancestors`
 * (clickjacking), `base-uri` (injected <base> redirecting every relative URL),
 * `form-action` (a posted form retargeted off-site) and `object-src`. Locking
 * `script-src` down properly means a per-request nonce, which means middleware,
 * which would make every page dynamic and give up the static rendering this app
 * currently gets for free — a bad trade for a dictionary whose pages are public.
 *
 * `img-src` allows data: for the generated icons and https: for the avatar
 * Google returns for a signed-in learner.
 */
// Audio may be served from a CDN bucket rather than this origin; if it is, the
// CSP has to admit it for both the fetch and the media element.
const audioOrigin = (() => {
  const base = process.env['NEXT_PUBLIC_AUDIO_BASE_URL'];
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
})();

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Ignored over plain http, so it costs nothing locally and matters in production.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next inlines the hydration payload as <script>self.__next_f.push(...)</script>
      // and React inlines critical <style>; without a nonce both need 'unsafe-inline'.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `media-src 'self' blob:${audioOrigin ? ` ${audioOrigin}` : ''}`,
      "font-src 'self' data:",
      `connect-src 'self'${audioOrigin ? ` ${audioOrigin}` : ''}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      // Auth.js posts the sign-in form to this origin and the server then 302s to
      // Google; some browsers check that redirect target against form-action, so
      // Google is listed here or sign-in breaks in a way that is hard to trace.
      "form-action 'self' https://accounts.google.com",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `standalone` keeps the app deployable as a container to Railway/Render: the
  // runtime stage ships the traced server rather than node_modules.
  //
  // Vercel builds with its own output pipeline and does not use this, so it is
  // opt-in via the Dockerfile. Leaving it on everywhere also made `next start`
  // warn locally that it was the wrong entrypoint.
  ...(process.env['BUILD_STANDALONE'] === '1' ? { output: 'standalone' as const } : {}),
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  // The version of the framework is not the public's business.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSerwist(withNextIntl(nextConfig));
