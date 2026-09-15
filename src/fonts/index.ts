import localFont from 'next/font/local';

/**
 * Three families, one per script, self-hosted from the repo.
 *
 * Self-hosted rather than Google's CDN for three reasons: zero third-party
 * request on a patchy mobile connection, no runtime dependency on a service we
 * don't control, and `next/font/local` computes fallback metric overrides
 * (size-adjust, ascent-override) automatically — which is what actually stops
 * the layout shifting when Amiri arrives.
 *
 * Only the script subset of each family is committed. Latin glyphs inside
 * Amiri and Noto Serif Bengali are deliberately absent: Latin is always set in
 * Plex, so those subsets would be dead weight on a 3G connection.
 */

export const amiri = localFont({
  // One weight only. Bold naskh is a Latin habit: Arabic emphasises with size,
  // colour and space, not with a heavier stroke — and the bold file was 100kB
  // of a font budget that has to survive patchy mobile data.
  src: './amiri-arabic-400-normal.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-amiri',
  display: 'swap',
  preload: true,
  fallback: ['Noto Naskh Arabic', 'serif'],
});

export const notoSerifBengali = localFont({
  src: './noto-serif-bengali-bengali-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-noto-bengali',
  display: 'swap',
  preload: true,
  fallback: ['Noto Sans Bengali', 'serif'],
});

export const plexSans = localFont({
  // Two weights: regular and semibold. A medium between them would be a third
  // file for a difference nobody can see at 14px.
  src: [
    { path: './ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
});

export const fontVariables = [amiri.variable, notoSerifBengali.variable, plexSans.variable].join(
  ' ',
);
