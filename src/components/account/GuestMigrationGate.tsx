'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { hasGuestDataFlag } from '@/lib/guest/flag';

/**
 * Almost every session has no guest data to move. This gate is what that
 * majority pays: a localStorage read. The migration UI — and with it Radix,
 * Dexie and the batching driver — is fetched only by the one session where a
 * learner has just signed in with local progress waiting.
 */
const GuestMigration = dynamic(async () => (await import('./GuestMigration')).GuestMigration, {
  ssr: false,
});

export function GuestMigrationGate(): ReactNode {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    setNeeded(hasGuestDataFlag());
  }, []);

  return needed ? <GuestMigration /> : null;
}
