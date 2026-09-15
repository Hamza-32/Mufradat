import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { signOut } from '@/auth';
import { getViewer } from '@/lib/auth/session';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'অ্যাকাউন্ট' };

export default async function AccountPage(): Promise<ReactNode> {
  const viewer = await getViewer();
  if (!viewer) redirect('/signin');
  const t = await getTranslations('auth');

  async function endSession(): Promise<void> {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AppShell>
      <PageBody className="max-w-2xl space-y-6">
        <SectionHeading>{t('account')}</SectionHeading>

        <Panel className="space-y-1 p-4">
          <p className="text-base font-semibold">{viewer.name ?? t('noName')}</p>
          <p className="text-pathor text-sm">{viewer.email}</p>
        </Panel>

        <form action={endSession}>
          <Button type="submit" variant="secondary">
            {t('signOut')}
          </Button>
        </form>
      </PageBody>
    </AppShell>
  );
}
