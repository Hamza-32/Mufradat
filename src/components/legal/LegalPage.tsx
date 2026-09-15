import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArabicText } from '@/components/text/ArabicText';

/**
 * The shell shared by the privacy policy and the terms.
 *
 * Deliberately built without the app shell and without a single database call.
 * Google re-checks these two URLs to keep the OAuth consent screen valid, and a
 * policy page that 500s because Postgres was asleep would take sign-in down
 * with it. Nothing here needs a session, so nothing here asks for one.
 */
export interface LegalSection {
  heading: string;
  body: string;
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  contactHeading,
  contactBody,
  contactEmail,
  backHome,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: readonly LegalSection[];
  contactHeading: string;
  contactBody: string;
  contactEmail: string;
  backHome: string;
}): ReactNode {
  return (
    <div className="bg-kagoj text-dawat min-h-dvh">
      <main className="mx-auto w-full max-w-2xl px-5 py-12 md:px-6 lg:py-16">
        <Link href="/" className="inline-block" aria-label={backHome}>
          <ArabicText size="lg" as="span" className="text-nil">
            مُفْرَدَات
          </ArabicText>
        </Link>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-pathor-soft mt-2 text-sm" data-numeric>
          {updated}
        </p>
        <p className="measure text-pathor mt-6 text-base leading-relaxed">{intro}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="measure text-pathor mt-2 text-base leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="border-hairline mt-10 border-t pt-8">
          <h2 className="text-lg font-semibold">{contactHeading}</h2>
          <p className="measure text-pathor mt-2 text-base leading-relaxed">{contactBody}</p>
          <a
            href={`mailto:${contactEmail}`}
            className="text-nil hover:text-nil-deep mt-2 inline-block break-all underline underline-offset-4"
          >
            {contactEmail}
          </a>
        </section>

        <Link
          href="/"
          className="border-hairline text-pathor hover:text-dawat mt-12 inline-flex min-h-11 items-center rounded-full border px-5 text-sm"
        >
          {backHome}
        </Link>
      </main>
    </div>
  );
}

/**
 * Who a learner writes to about their data.
 *
 * Read straight from process.env rather than through `env()`: that validates
 * DATABASE_URL, and these pages are the ones that must render when the database
 * cannot be reached. The fallback is the address already published on the
 * Google consent screen, so the page is never left without a contact.
 */
export function contactEmail(): string {
  return process.env['NEXT_PUBLIC_CONTACT_EMAIL'] || 'hamzabinarif.arif@gmail.com';
}
