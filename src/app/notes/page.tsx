import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { NotesWorkspace } from '@/components/notes/NotesWorkspace';
import { getViewer } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'নোট' };
export const dynamic = 'force-dynamic';

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ word?: string; new?: string }>;
}): Promise<ReactNode> {
  const t = await getTranslations('notes');
  const viewer = await getViewer();
  const { word, new: isNew } = await searchParams;

  return (
    <AppShell>
      <PageBody className="space-y-4">
        <SectionHeading>{t('title')}</SectionHeading>
        <NotesWorkspace
          signedIn={viewer !== null}
          {...(word ? { initialWordId: word } : {})}
          {...(isNew !== undefined ? { startNew: true } : {})}
        />
      </PageBody>
    </AppShell>
  );
}
