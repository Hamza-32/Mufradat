import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LegalPage, contactEmail, type LegalSection } from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return { title: t('termsTitle') };
}

export default async function TermsPage(): Promise<ReactNode> {
  const t = await getTranslations('legal');

  const sections: readonly LegalSection[] = [
    { heading: t('termsUseHeading'), body: t('termsUseBody') },
    // Deliberately near the top: this is a Qur'anic vocabulary app, and the
    // limits of a learning gloss matter more here than the usual boilerplate.
    { heading: t('termsAccuracyHeading'), body: t('termsAccuracyBody') },
    { heading: t('termsAccountsHeading'), body: t('termsAccountsBody') },
    { heading: t('termsGuestDataHeading'), body: t('termsGuestDataBody') },
    { heading: t('termsAvailabilityHeading'), body: t('termsAvailabilityBody') },
    { heading: t('termsChangesHeading'), body: t('termsChangesBody') },
  ];

  return (
    <LegalPage
      title={t('termsTitle')}
      updated={t('updated')}
      intro={t('termsIntro')}
      sections={sections}
      contactHeading={t('contactHeading')}
      contactBody={t('contactBody')}
      contactEmail={contactEmail()}
      backHome={t('backHome')}
    />
  );
}
