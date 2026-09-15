'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ButtonLink } from '@/components/ui/Button';

/**
 * The route-level error boundary. Without it an unhandled server error renders
 * the framework's default page: no navigation, no language, no way back.
 *
 * `reset()` re-renders the segment, which is genuinely worth offering here —
 * most failures in this app are a dropped database connection on a cold start,
 * and the second attempt succeeds.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactNode {
  const t = useTranslations('errors');

  useEffect(() => {
    // The digest is the only handle on the server-side stack, which the client
    // never sees. Without logging it here a production report is unfindable.
    console.error('route error', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-dawat text-2xl font-semibold lg:text-3xl">{t('crashTitle')}</h1>
      <p className="measure text-pathor text-base">{t('crashBody')}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" onClick={reset}>
          {t('tryAgain')}
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          {t('backHome')}
        </ButtonLink>
      </div>
      {error.digest ? (
        <p className="font-latin text-2xs text-pathor-soft mt-2" data-numeric>
          {error.digest}
        </p>
      ) : null}
    </main>
  );
}
