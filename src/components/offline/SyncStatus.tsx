'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

/**
 * One place in the whole interface reports the network, because a learner
 * reviewing does not need a warning per card — their answers are already safe
 * on the device. This says how many are still waiting, and it disappears the
 * moment the queue empties.
 */
export function SyncStatus({ className }: { className?: string }): ReactNode {
  const t = useTranslations('sync');
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { pendingCount } = await import('@/lib/offline/outbox');
      const count = await pendingCount();
      if (!cancelled) {
        setPending(count);
        setOnline(navigator.onLine);
      }
    }

    void refresh();

    let unsubscribe = () => undefined as void;
    void import('@/lib/offline/outbox').then(({ onOutboxChanged, flushOutbox }) => {
      if (cancelled) return;
      unsubscribe = onOutboxChanged(() => {
        void refresh();
      });
      // Coming back online is the moment the queue should drain.
      const onOnline = () => {
        void flushOutbox();
      };
      window.addEventListener('online', onOnline);
      void flushOutbox();
      const previous = unsubscribe;
      unsubscribe = () => {
        previous();
        window.removeEventListener('online', onOnline);
      };
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <p
      role="status"
      className={cn(
        'rounded-ui flex items-center gap-2 border px-3 py-1.5 text-xs',
        online
          ? 'border-hairline bg-chuna text-pathor'
          : 'border-shingraf/40 bg-shingraf-wash text-dawat',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', online ? 'bg-nil' : 'bg-shingraf')}
      />
      <span data-numeric>
        {online ? t('pending', { count: pending }) : t('offline', { count: pending })}
      </span>
    </p>
  );
}
