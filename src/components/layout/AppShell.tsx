import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/cn';
import { getUserLocale } from '@/i18n/locale';
import { getViewer } from '@/lib/auth/session';
import { GuestMigrationGate } from '@/components/account/GuestMigrationGate';
import { SyncStatus } from '@/components/offline/SyncStatus';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { LanguageToggle } from './LanguageToggle';
import { SignOutButton } from '@/components/account/SignOutButton';

/**
 * The app frame. Phone: a slim header carrying only the name and the language
 * toggle, content, and a fixed bottom bar. Tablet and desktop: the navigation
 * moves to the side and the header disappears entirely, because a persistent
 * sidebar already says where you are.
 *
 * `chrome={false}` is for the review session and any other full-screen task:
 * navigation away from a session should be a deliberate act, not a stray thumb.
 */
export async function AppShell({
  children,
  chrome = true,
}: {
  children: ReactNode;
  chrome?: boolean;
}): Promise<ReactNode> {
  const locale = await getUserLocale();
  const viewer = await getViewer();
  const t = await getTranslations();
  const account = viewer
    ? { href: '/account', label: viewer.name ?? t('auth.account') }
    : { href: '/signin', label: t('auth.signIn') };

  if (!chrome) {
    return (
      <div className="min-h-dvh">
        <a
          href="#main"
          className="focus:rounded-ui focus:bg-nil focus:text-chuna sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:px-4 focus:py-2"
        >
          {t('app.skipToContent')}
        </a>
        {/* Offline matters most inside a review session, so the status follows
            the learner in here too. It stays pointer-events-none: it is a
            read-only notice pinned over the reveal button, and making it
            clickable meant a learner could not press that button offline —
            precisely when the notice is on screen. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-2 z-30 flex justify-center px-4">
          <SyncStatus />
        </div>
        <main id="main">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="focus:rounded-ui focus:bg-nil focus:text-chuna sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:px-4 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      <Sidebar
        locale={locale}
        account={account}
        signOutLabel={viewer ? t('auth.signOut') : undefined}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            'sticky top-0 z-20 flex h-14 items-center justify-between gap-3',
            'border-hairline bg-kagoj/95 border-b px-4 backdrop-blur-none',
            'md:hidden',
          )}
        >
          <span lang="bn" className="font-bengali text-nil text-lg font-semibold">
            {t('app.name')}
          </span>
          <div className="flex items-center gap-2">
            <LanguageToggle locale={locale} />
            <a
              href={account.href}
              className="min-h-touch rounded-ui text-nil hover:bg-nil-wash inline-flex items-center px-2 text-sm"
            >
              {account.label}
            </a>
            {/* The phone header is the only chrome a learner sees on a small
                screen, so the way out lives here rather than one tap deeper. */}
            {viewer ? <SignOutButton label={t('auth.signOut')} className="px-1.5" /> : null}
          </div>
        </header>

        {/* Sits above the content on every screen, including the full-screen
            review session, because that is where offline actually happens. */}
        <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4 md:top-4">
          <SyncStatus className="shadow-none" />
        </div>

        <main
          id="main"
          // Clear the fixed bottom bar on the phone; no padding needed once the
          // navigation moves to the side.
          className="min-w-0 flex-1 pb-[calc(var(--spacing-nav)+env(safe-area-inset-bottom,0px)+1rem)] md:pb-0"
        >
          {children}
        </main>
      </div>

      <BottomNav />

      {/* Signed in and the device still holds guest progress? Move it across. */}
      {viewer ? <GuestMigrationGate /> : null}
    </div>
  );
}

/**
 * The page's content column. Full-bleed on the phone (cards run edge to edge),
 * gaining gutters at 768 and a ceiling at 1600 so a wide display gets a wider
 * grid rather than wider paragraphs.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={cn('mx-auto w-full max-w-[90rem] px-4 py-5 md:px-6 lg:px-8 lg:py-8', className)}
    >
      {children}
    </div>
  );
}
