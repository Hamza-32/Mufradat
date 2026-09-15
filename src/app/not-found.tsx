import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { AppShell, PageBody } from '@/components/layout/AppShell';
import { ButtonLink } from '@/components/ui/Button';

/**
 * A mistyped word id or a stale link should land somewhere that still looks
 * like the app and still offers a way on, rather than on the framework's
 * unstyled default.
 */
export default async function NotFound(): Promise<ReactNode> {
  const t = await getTranslations('errors');

  return (
    <AppShell>
      <PageBody className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-latin text-pathor-soft text-sm" data-numeric>
          404
        </p>
        <h1 className="text-dawat text-2xl font-semibold lg:text-3xl">{t('notFoundTitle')}</h1>
        <p className="measure text-pathor text-base">{t('notFoundBody')}</p>
        <ButtonLink href="/" variant="primary" size="lg" className="mt-2">
          {t('backHome')}
        </ButtonLink>
      </PageBody>
    </AppShell>
  );
}
