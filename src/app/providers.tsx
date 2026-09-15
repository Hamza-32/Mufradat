'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Server state only. Defaults are tuned for a phone on patchy data: keep
 * results usable for a minute, do not refetch on every window focus, and retry
 * once rather than hammering a connection that is already struggling.
 */
export function Providers({ children }: { children: ReactNode }): ReactNode {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
