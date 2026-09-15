import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LegalPage, contactEmail, type LegalSection } from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return { title: t('privacyTitle') };
}

export default async function PrivacyPage(): Promise<ReactNode> {
  const t = await getTranslations('legal');

  const sections: readonly LegalSection[] = [
    { heading: t('privacyGuestHeading'), body: t('privacyGuestBody') },
    { heading: t('privacyAccountHeading'), body: t('privacyAccountBody') },
    { heading: t('privacyLearningHeading'), body: t('privacyLearningBody') },
    { heading: t('privacyCookiesHeading'), body: t('privacyCookiesBody') },
    { heading: t('privacyThirdPartyHeading'), body: t('privacyThirdPartyBody') },
    { heading: t('privacyTrackingHeading'), body: t('privacyTrackingBody') },
    { heading: t('privacyDeleteHeading'), body: t('privacyDeleteBody') },
  ];

  return (
    <LegalPage
      title={t('privacyTitle')}
      updated={t('updated')}
      intro={t('privacyIntro')}
      sections={sections}
      contactHeading={t('contactHeading')}
      contactBody={t('contactBody')}
      contactEmail={contactEmail()}
      backHome={t('backHome')}
    />
  );
}
