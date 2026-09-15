export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Bengali is the default: this app is for Bengali speakers, not for everyone. */
export const DEFAULT_LOCALE: Locale = 'bn';

export const LOCALE_COOKIE = 'mufradat.locale';

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}
