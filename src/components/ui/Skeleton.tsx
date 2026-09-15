import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Loading placeholders are sized to the content they stand in for, so the
 * real thing arriving does not move the page. No shimmer sweep: a slow opacity
 * pulse is enough, and it disappears entirely under reduced motion.
 */
export function Skeleton({ className }: { className?: string }): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-data bg-hairline-soft animate-pulse', className)}
    />
  );
}

/** A deck row placeholder: title line, progress bar, count. */
export function DeckRowSkeleton(): ReactNode {
  return (
    <div className="space-y-2 py-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-1.5 w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/** A word row placeholder, with the Arabic line taller than the gloss lines. */
export function WordRowSkeleton(): ReactNode {
  return (
    <div className="space-y-2 py-3">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}
