import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button, ButtonLink } from './Button';

/**
 * An empty screen is an invitation to act, so it always carries one verb.
 * An error says what went wrong and what to do about it, in the interface's
 * voice — it does not apologise and it is never vague.
 */

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}): ReactNode {
  return (
    <div className={cn('measure space-y-3 py-10 text-start', className)}>
      <p className="text-dawat text-lg font-semibold">{title}</p>
      {body ? <p className="text-pathor text-base">{body}</p> : null}
      {action ? (
        action.href ? (
          <ButtonLink href={action.href} variant="primary">
            {action.label}
          </ButtonLink>
        ) : (
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel: string;
  className?: string;
}): ReactNode {
  return (
    <div
      role="alert"
      className={cn(
        'measure border-shingraf bg-shingraf-wash/50 space-y-3 border-s-2 p-4',
        'rounded-e-ui',
        className,
      )}
    >
      <p className="text-dawat text-base font-semibold">{title}</p>
      {body ? <p className="text-pathor text-sm">{body}</p> : null}
      {onRetry ? (
        <Button variant="rubric" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
