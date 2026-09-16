'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { endSession } from '@/lib/auth/actions';
import { SignOutIcon } from '@/components/icons';

function Submit({
  label,
  className,
}: {
  label: string;
  className?: string | undefined;
}): ReactNode {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'min-h-touch rounded-ui inline-flex items-center gap-2 px-2',
        'text-pathor hover:bg-nil-wash hover:text-nil disabled:opacity-60',
        className,
      )}
    >
      <SignOutIcon width={16} height={16} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Signing out, as a control a learner can actually find.
 *
 * It used to live only inside the account page, which you reached by tapping
 * your own name — so someone who had just signed in had no visible way back
 * out. A destructive-ish action should not be a scavenger hunt.
 */
export function SignOutButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}): ReactNode {
  return (
    <form action={endSession}>
      <Submit label={label} className={className} />
    </form>
  );
}
