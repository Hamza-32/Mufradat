import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Deck completion and session progress. Square ends: this is a data surface. */
export function ProgressBar({
  value,
  max,
  label,
  className,
  tone = 'nil',
}: {
  value: number;
  max: number;
  /** Read by screen readers. Required — a bare bar says nothing. */
  label: string;
  className?: string;
  tone?: 'nil' | 'shingraf';
}): ReactNode {
  const safeMax = Math.max(max, 1);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
      className={cn('rounded-data bg-hairline-soft h-1.5 w-full overflow-hidden', className)}
    >
      <div
        className={cn('ease-card h-full transition-[width] duration-300', {
          'bg-nil': tone === 'nil',
          'bg-shingraf': tone === 'shingraf',
        })}
        style={{ inlineSize: `${pct}%` }}
      />
    </div>
  );
}
