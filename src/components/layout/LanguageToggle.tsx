'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { setUserLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/config';

/**
 * A two-option segmented control rather than a dropdown: there are exactly two
 * languages, and a select would hide one of them behind a tap. Each option is
 * labelled in its own language and set in its own face, so a learner who cannot
 * read the current UI language can still find their way out.
 */
export function LanguageToggle({
  locale,
  tone = 'paper',
  className,
}: {
  locale: Locale;
  /** `dark` is the signed-out landing, which sits on navy rather than paper. */
  tone?: 'paper' | 'dark';
  className?: string;
}): ReactNode {
  const t = useTranslations('language');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale): void {
    if (next === locale) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(
        'inline-flex rounded-full border p-0.5',
        tone === 'dark'
          ? 'border-layl-line bg-layl-deep/70'
          : 'rounded-ui border-hairline bg-kagoj',
        pending && 'opacity-60',
        className,
      )}
    >
      {(['bn', 'en'] as const).map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            disabled={pending}
            onClick={() => {
              choose(option);
            }}
            className={cn(
              'min-h-touch px-3 text-sm transition-colors duration-150',
              tone === 'dark' ? 'rounded-full' : 'rounded-data',
              option === 'bn' ? 'font-bengali' : 'font-latin',
              tone === 'dark'
                ? active
                  ? 'bg-layl-soft text-subh font-semibold'
                  : 'text-subh-soft hover:text-subh'
                : active
                  ? 'bg-chuna text-nil font-semibold shadow-none'
                  : 'text-pathor hover:text-nil',
            )}
          >
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
