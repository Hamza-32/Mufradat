'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A toggle that reads as a filter rather than a button: hairline when off,
 * indigo wash when on. `aria-pressed` carries the state, so it is never colour
 * alone that says which filter is active.
 */
export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-touch rounded-ui border px-3 text-sm whitespace-nowrap transition-colors duration-150',
        active
          ? 'border-nil bg-nil-wash text-nil font-semibold'
          : 'border-hairline bg-chuna text-pathor hover:border-nil-soft hover:text-nil',
        className,
      )}
    >
      {children}
    </button>
  );
}
