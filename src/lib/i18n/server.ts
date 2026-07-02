import { cookies } from 'next/headers';
import { translate } from './translate';
import { DEFAULT_LOCALE, isLocale, Locale, LOCALE_COOKIE, TranslationVars } from './types';

/** Server Components read the same `app_locale` cookie the client toggle
 *  writes (see `LocaleProvider.tsx`), so the very first server-rendered
 *  HTML is already in the right language — no flash of the wrong
 *  language before client hydration. */
export function getServerLocale(): Locale {
  const raw = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Reads the locale from a plain `Request`/`NextRequest`'s Cookie header -
 *  used by API routes (PDF/CSV export) where `next/headers`'s `cookies()`
 *  works too, but an explicit request-scoped read is easier to unit test
 *  without mocking the App Router's async storage. */
export function getLocaleFromCookieHeader(cookieHeader: string | null | undefined): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE;
  const match = cookieHeader.match(new RegExp(`${LOCALE_COOKIE}=([a-z]+)`));
  const raw = match?.[1];
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Server Component / Route Handler translation helper - reads the
 *  current request's locale automatically, so callers just do
 *  `t('common.vehicle')` without threading a locale value through props. */
export function t(key: string, vars?: TranslationVars): string {
  return translate(getServerLocale(), key, vars);
}
