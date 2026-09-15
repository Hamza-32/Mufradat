'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isActive } from './nav-items';

/**
 * Phone navigation: fixed to the bottom, inside thumb reach, five targets each
 * at least 44px on both axes and clearing the gesture bar.
 *
 * The active indicator is a 2px rule above the label — the matra a line of
 * Bengali type hangs from. It is the same stroke the section headings use, so
 * "where am I" and "what is this section" are told in one vocabulary.
 */
export function BottomNav({ className }: { className?: string }): ReactNode {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav
      aria-label={t('label')}
      className={cn(
        'border-hairline bg-chuna pb-safe fixed inset-x-0 bottom-0 z-30 border-t',
        'md:hidden',
        className,
      )}
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'min-h-nav flex flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1',
                  'text-2xs border-t-2',
                  active
                    ? 'border-nil text-nil font-semibold'
                    : 'text-pathor border-transparent font-normal',
                )}
              >
                <Icon width={22} height={22} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
