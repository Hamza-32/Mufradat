'use server';

import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';

/**
 * The UI language lives in a cookie, not in the URL. A locale-prefixed route
 * would mean every word, deck and note URL exists twice, which is the wrong
 * trade for an app whose content is trilingual on every page anyway.
 */
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  return isLocale(store.get(LOCALE_COOKIE)?.value)
    ? (store.get(LOCALE_COOKIE)!.value as Locale)
    : DEFAULT_LOCALE;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
