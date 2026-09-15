'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CloseIcon } from '@/components/icons';

/**
 * One component, two designed behaviours: a bottom sheet under 768px, where a
 * centred modal would be unreachable by thumb, and a centred panel above it.
 * Radix handles focus trapping, escape, and the scroll lock; every visual
 * token is ours — none of the default styling survives.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
}): ReactNode {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-dawat/35 fixed inset-0 z-40 [animation:overlay-in_150ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'bg-chuna text-dawat fixed z-50',
            // Phone: a sheet that rises from the edge the thumb is nearest.
            'inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto',
            'rounded-t-sheet border-hairline shadow-sheet border-t',
            '[animation:sheet-in_220ms_var(--ease-card)]',
            // Tablet and up: a centred panel, no shadow, it is not floating.
            'md:inset-auto md:start-1/2 md:top-1/2 md:max-h-[80dvh] md:w-[min(34rem,92vw)]',
            'md:rounded-sheet md:-translate-x-1/2 md:-translate-y-1/2 md:border md:shadow-none',
            'md:[animation:sheet-in-centred_160ms_var(--ease-card)]',
          )}
        >
          {/* Grab handle: phone only, and decorative — the close button is real. */}
          <div
            aria-hidden="true"
            className="rounded-data bg-hairline mx-auto mt-2 h-1 w-9 md:hidden"
          />
          <div className="flex items-start justify-between gap-4 p-4 pb-2">
            <div className="space-y-1">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-pathor text-sm">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label={closeLabel}
              className="size-touch rounded-ui text-pathor hover:bg-nil-wash hover:text-nil -me-1 inline-flex shrink-0 items-center justify-center"
            >
              <CloseIcon />
            </Dialog.Close>
          </div>
          <div className="px-4 pb-4">{children}</div>
          {footer ? (
            <div className="border-hairline-soft pb-safe border-t p-4 md:pb-4">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
