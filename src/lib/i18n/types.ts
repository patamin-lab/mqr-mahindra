/**
 * Localization framework — core types.
 *
 * Reused by every module (MQR, PM, and any future module — PDI, NTR,
 * Dashboard, Warranty, Campaign, AI Copilot) without redesign: a module
 * adds its own top-level namespace to `src/locales/th.json`/`en.json`
 * (see `Dictionary` below) and calls `t('itsNamespace.someKey')` from
 * either a Server Component (`lib/i18n/server.ts`) or a Client Component
 * (`lib/i18n/LocaleProvider.tsx`'s `useTranslation()`). No per-module
 * localization code, no second implementation.
 */
export type Locale = 'th' | 'en';

export const DEFAULT_LOCALE: Locale = 'th';
export const SUPPORTED_LOCALES: Locale[] = ['th', 'en'];

/** Cookie the whole app reads/writes to persist the user's locale choice
 *  — same cookie both Server Components (`server.ts`) and the client
 *  toggle (`LocaleProvider.tsx`) agree on, so SSR and hydration never
 *  disagree about which language to render. Distinct from the legacy
 *  `googtrans` cookie the old Google Translate widget used - that cookie
 *  is still written too, for the transitional fallback (see
 *  `LocaleProvider.tsx`'s doc comment), but it is no longer the source
 *  of truth for anything this app controls. */
export const LOCALE_COOKIE = 'app_locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'th' || value === 'en';
}

/** Variables interpolated into a translated string via `{name}` placeholders. */
export type TranslationVars = Record<string, string | number>;
