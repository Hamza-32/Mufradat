import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A heading hangs from a 2px rule, the way a line of Bengali type hangs from
 * its matra. This replaces the tracked-out all-caps eyebrow: Bengali has no
 * letter case, so a caps label would be meaningless in the app's primary
 * language and would have to be faked or left in English.
 */
export function SectionHeading({
  children,
  action,
  level = 2,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
  className?: string;
}): ReactNode {
  const Tag = level === 2 ? 'h2' : 'h3';

  return (
    <div className={cn('matra flex items-baseline justify-between gap-4', className)}>
      <Tag className={cn(level === 2 ? 'text-lg' : 'text-base', 'text-dawat font-semibold')}>
        {children}
      </Tag>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}
