import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { getTranslations } from 'next-intl/server';
import { ArabicText } from '@/components/text/ArabicText';

/**
 * The service worker's fallback for a page the learner has never opened with no
 * network to fetch it.
 *
 * Deliberately built without the app shell: the shell reads the session, which
 * means a database call, and the one page that has to render with nothing
 * available should depend on nothing. It says what still works rather than only
 * what does not.
 */
export default async function OfflinePage(): Promise<ReactNode> {
  const t = await getTranslations('sync');

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-6">
      <ArabicText size="lg" as="p" className="text-nil">
        مُفْرَدَات
      </ArabicText>
      <h1 className="text-2xl font-semibold">{t('offlinePageTitle')}</h1>
      <p className="measure text-pathor text-base">{t('offlinePageBody')}</p>
      <ButtonLink href="/review" variant="primary" size="lg" className="w-fit">
        {t('backToReview')}
      </ButtonLink>
    </main>
  );
}
