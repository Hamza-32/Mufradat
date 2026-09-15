import type { MetadataRoute } from 'next';

/**
 * Installed to a home screen, this opens straight into the review session —
 * not the marketing-shaped home page. Someone who installed a vocabulary app
 * on their phone wants to review.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'মুফরাদাত — আরবি শব্দভাণ্ডার',
    short_name: 'মুফরাদাত',
    description: 'আরবি শব্দ শিখুন বাংলা ও ইংরেজি অর্থসহ: ফ্ল্যাশকার্ড, ছোট খেলা আর নিজের নোট।',
    lang: 'bn',
    dir: 'ltr',
    start_url: '/review',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b2438',
    theme_color: '#0b2438',
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'আজকের পড়া', url: '/review' },
      { name: 'শব্দ খুঁজুন', url: '/words' },
      { name: 'নোট', url: '/notes' },
    ],
  };
}
