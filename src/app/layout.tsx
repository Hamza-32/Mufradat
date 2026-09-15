import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { fontVariables } from '@/fonts';
import { siteUrl } from '@/lib/site';
import { getUserLocale } from '@/i18n/locale';
import { RegisterServiceWorker } from '@/components/offline/RegisterServiceWorker';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  // Absolute URLs for every relative asset in the metadata below. Without it
  // Next warns at build and social cards resolve against the wrong origin.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'মুফরাদাত — বাংলা ভাষাভাষীদের জন্য আরবি শব্দভাণ্ডার',
    template: '%s · মুফরাদাত',
  },
  description: 'আরবি শব্দ শিখুন বাংলা ও ইংরেজি অর্থসহ: ফ্ল্যাশকার্ড, ছোট খেলা আর নিজের নোট।',
  applicationName: 'Mufradat',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'মুফরাদাত', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false, address: false, email: false },
  // A shared link should say what the thing is in the language of the people it
  // is for, rather than showing a bare URL.
  openGraph: {
    type: 'website',
    siteName: 'Mufradat',
    locale: 'bn_BD',
    alternateLocale: ['en_US'],
    title: 'মুফরাদাত — বাংলা ভাষাভাষীদের জন্য আরবি শব্দভাণ্ডার',
    description: 'আরবি শব্দ শিখুন বাংলা ও ইংরেজি অর্থসহ: ফ্ল্যাশকার্ড, ছোট খেলা আর নিজের নোট।',
  },
  twitter: {
    card: 'summary',
    title: 'মুফরাদাত — আরবি শব্দভাণ্ডার',
    description: 'বাংলা ভাষাভাষীদের জন্য আরবি শব্দ শেখার সহজ পথ।',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never lock zoom: a learner squinting at a harakat must be able to pinch in.
  maximumScale: 5,
  themeColor: '#0b2438',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const locale = await getUserLocale();
  const messages = await getMessages();

  return (
    // The UI language sets `lang` on the document; Arabic is always marked
    // locally by <ArabicText>. Both UI languages are left-to-right.
    <html lang={locale} dir="ltr" className={fontVariables}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>{children}</Providers>
          <RegisterServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
