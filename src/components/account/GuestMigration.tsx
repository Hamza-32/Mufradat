'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { GuestSummary } from '@/lib/guest/db';
import type { MigrationProgress } from '@/lib/guest/migrate-client';
import type { MigrationResult } from '@/lib/guest/payload';

type Phase =
  | { name: 'idle' }
  | { name: 'found'; summary: GuestSummary }
  | { name: 'sending'; summary: GuestSummary; progress: MigrationProgress }
  | { name: 'done'; totals: MigrationResult }
  | { name: 'failed'; summary: GuestSummary };

/**
 * Mounted once, inside the shell, for signed-in learners only.
 *
 * The migration starts on its own — a learner who has just signed in should not
 * have to ask for their own work — but it is never silent. They are told what
 * moved, and on failure they are told plainly that nothing was lost and the
 * local copy is still there.
 */
export function GuestMigration(): ReactNode {
  const t = useTranslations('migration');
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const started = useRef(false);

  const run = useCallback(
    async (summary: GuestSummary) => {
      setPhase({ name: 'sending', summary, progress: { sent: 0, total: 1 } });
      // Dexie and the migration driver load here, not in the shell bundle.
      const { migrateGuestData } = await import('@/lib/guest/migrate-client');
      const outcome = await migrateGuestData((progress) => {
        setPhase({ name: 'sending', summary, progress });
      });

      if (outcome.status === 'done') {
        setPhase({ name: 'done', totals: outcome.totals });
        router.refresh();
      } else if (outcome.status === 'failed') {
        setPhase({ name: 'failed', summary });
      } else {
        setPhase({ name: 'idle' });
      }
    },
    [router],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void import('@/lib/guest/db').then(async ({ summariseGuestData }) => {
      const summary = await summariseGuestData();
      if (summary) await run(summary);
    });
  }, [run]);

  if (phase.name === 'idle') return null;

  const sending = phase.name === 'sending';

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        // A migration in flight cannot be dismissed; a finished one can.
        if (!next && !sending) setPhase({ name: 'idle' });
      }}
      closeLabel={t('close')}
      title={
        phase.name === 'done'
          ? t('doneTitle')
          : phase.name === 'failed'
            ? t('failedTitle')
            : t('title')
      }
      description={phase.name === 'failed' ? t('failedBody') : undefined}
      footer={
        phase.name === 'failed' ? (
          <Button variant="primary" fullWidth onClick={() => void run(phase.summary)}>
            {t('retry')}
          </Button>
        ) : phase.name === 'done' ? (
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setPhase({ name: 'idle' });
            }}
          >
            {t('close')}
          </Button>
        ) : null
      }
    >
      {sending ? (
        <div className="space-y-3">
          <p className="text-pathor text-sm">{t('body', { count: phase.summary.total })}</p>
          <ProgressBar
            value={phase.progress.sent}
            max={phase.progress.total}
            label={t('progress', { done: phase.progress.sent, total: phase.progress.total })}
          />
        </div>
      ) : phase.name === 'done' ? (
        <p className="text-pathor text-sm">
          {t('doneBody', {
            cards: phase.totals.cardsWritten,
            reviews: phase.totals.logsWritten,
          })}
        </p>
      ) : null}
    </Sheet>
  );
}
