import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { googleConfigured, signIn } from '@/auth';
import { getViewer } from '@/lib/auth/session';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { Panel } from '@/components/ui/Panel';
import { ArabicText } from '@/components/text/ArabicText';
import { GoogleButton } from '@/components/account/GoogleButton';

export const metadata: Metadata = { title: 'সাইন ইন' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactNode> {
  const viewer = await getViewer();
  if (viewer) redirect('/account');

  const t = await getTranslations('auth');
  const { error } = await searchParams;

  async function withGoogle(): Promise<void> {
    'use server';
    await signIn('google', { redirectTo: '/' });
  }

  return (
    <AppShell chrome={false}>
      <PageBody className="flex min-h-dvh max-w-xl flex-col justify-center gap-8">
        <div className="space-y-3">
          <ArabicText size="lg" as="p" className="text-nil">
            مُفْرَدَات
          </ArabicText>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="measure text-pathor text-base">{t('body')}</p>
        </div>

        {error ? (
          <p role="alert" className="border-shingraf bg-shingraf-wash/50 border-s-2 p-3 text-sm">
            {t('failed')}
          </p>
        ) : null}

        {googleConfigured() ? (
          <form action={withGoogle}>
            <GoogleButton label={t('google')} />
          </form>
        ) : (
          // Better to say the door is not there than to show one that opens on
          // a Google error page.
          <p
            role="status"
            className="border-hairline bg-chuna/60 text-pathor border-s-2 p-3 text-sm"
          >
            {t('googleUnavailable')}
          </p>
        )}

        <Panel className="space-y-2 p-4">
          <p className="text-base font-semibold">{t('guestTitle')}</p>
          <p className="text-pathor text-sm">{t('guestBody')}</p>
          <Link
            href="/"
            className="min-h-touch rounded-ui border-hairline bg-chuna hover:bg-nil-wash inline-flex items-center border px-4 text-base"
          >
            {t('guest')}
          </Link>
        </Panel>
      </PageBody>
    </AppShell>
  );
}
