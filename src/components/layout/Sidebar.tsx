'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isActive } from './nav-items';
import { LanguageToggle } from './LanguageToggle';
import { SignOutButton } from '@/components/account/SignOutButton';
import type { Locale } from '@/i18n/config';

/**
 * Two designed states, not one that shrinks:
 *
 *  768–1023 — a 64px rail. Icon over a small label, no tooltips, because a
 *             tablet is a touch device and a hover tooltip would be unreachable.
 *  ≥1024    — a 240px persistent sidebar. Never a hamburger.
 *
 * The active item is marked by a 2px rule on its leading edge: the same stroke
 * as the bottom bar's matra, turned to suit a vertical list.
 */
export function Sidebar({
  locale,
  account,
  signOutLabel,
  className,
}: {
  locale: Locale;
  account: { href: string; label: string };
  /** Only a signed-in learner has a session to end. */
  signOutLabel?: string | undefined;
  className?: string;
}): ReactNode {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <div
      className={cn(
        'hidden md:flex md:shrink-0 md:flex-col',
        'md:w-rail lg:w-sidebar',
        'border-hairline bg-chuna border-e',
        'md:sticky md:top-0 md:h-dvh',
        className,
      )}
    >
      <div className="flex h-14 items-center justify-center px-3 lg:h-16 lg:justify-start lg:px-4">
        <Link href="/" className="font-bengali text-nil text-lg font-semibold lg:text-xl" lang="bn">
          <span className="lg:hidden" aria-hidden="true">
            م
          </span>
          <span className="hidden lg:inline">{t('app.name')}</span>
          <span className="sr-only lg:hidden">{t('app.name')}</span>
        </Link>
      </div>

      <nav aria-label={t('nav.label')} className="flex-1 px-2 lg:px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'min-h-touch rounded-ui flex items-center border-s-2 transition-colors duration-150',
                    'text-2xs flex-col justify-center gap-0.5 py-2',
                    'lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base',
                    active
                      ? 'border-nil bg-nil-wash text-nil font-semibold'
                      : 'text-pathor hover:bg-nil-wash/50 hover:text-nil border-transparent',
                  )}
                >
                  <Icon width={22} height={22} />
                  <span>{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-hairline-soft space-y-2 border-t p-2 lg:p-3">
        <Link
          href={account.href}
          className="min-h-touch rounded-ui text-2xs text-pathor hover:bg-nil-wash hover:text-nil flex items-center justify-center px-2 lg:justify-start lg:text-sm"
        >
          <span className="truncate">{account.label}</span>
        </Link>
        {/* Beside the name rather than buried inside the account page: someone
            who has just signed in should be able to see the way back out. */}
        {signOutLabel ? (
          <SignOutButton
            label={signOutLabel}
            className="text-2xs w-full justify-center lg:justify-start lg:text-sm"
          />
        ) : null}
        <LanguageToggle locale={locale} />
      </div>
    </div>
  );
}
