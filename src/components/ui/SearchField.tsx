'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { SearchIcon } from '@/components/icons';

/**
 * The one search field. `dir="auto"` is the reason it is a component rather
 * than a class string: a learner typing Arabic must see the caret move right to
 * left, and a learner typing Bengali must not. Getting that wrong in one of the
 * two places it appears would be invisible to whoever wrote the other.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}): ReactNode {
  return (
    <div className={cn('relative flex-1', className)}>
      <span
        aria-hidden="true"
        className="text-pathor pointer-events-none absolute inset-y-0 start-3 flex items-center"
      >
        <SearchIcon width={18} height={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        aria-label={label}
        dir="auto"
        className="min-h-touch rounded-ui border-hairline bg-chuna placeholder:text-pathor-soft focus-visible:border-nil w-full border ps-10 pe-3 text-base"
      />
    </div>
  );
}
