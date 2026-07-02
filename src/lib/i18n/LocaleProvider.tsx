'use client';

/**
 * Client-side locale context - the single source of truth for the app's
 * current language on the client, paired with `server.ts`'s
 * `getServerLocale()` on the server (both read/write the same
 * `app_locale` cookie, so SSR and hydration always agree).
 *
 * This is the REAL localization engine (Task 10 / RC1 follow-up). The
 * previous mechanism (Google Translate's Website Translator widget,
 * still present in `app/language-toggle.tsx` as `applyLegacyGoogleTranslate()`)
 * is kept ONLY as a transitional fallback for whatever UI text hasn't
 * been migrated to `src/locales/*.json` yet - it no longer drives PDF,
 * CSV, validation messages, standardized terminology, or dates, all of
 * which read `locale` from this context (client) or `getServerLocale()`
 * (server) directly. Already-migrated regions render through `t()`, are
 * exact/controlled per the dictionary, and are marked `notranslate` so
 * Google's widget never re-touches them.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from './translate';
import { Locale, LOCALE_COOKIE, TranslationVars } from './types';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  // Explicit state (not "read the cookie on every render") so every
  // Client Component under this provider re-renders the instant the
  // user picks a language - before router.refresh()'s Server Component
  // re-render even completes, for a snappier switch.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      writeLocaleCookie(next);
      setLocaleState(next);
      // Re-runs every Server Component on the current route with the new
      // cookie value - a Next.js "soft" refresh (no full browser reload,
      // no lost client-side state elsewhere on the page), which is what
      // "switch without refreshing the application" means in an App
      // Router app where most pages are Server Components.
      router.refresh();
    },
    [router]
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale() must be called inside <LocaleProvider>');
  }
  return ctx;
}

/** The primary hook Client Components use: `const { t } = useTranslation();`. */
export function useTranslation() {
  const { locale } = useLocale();
  const t = useCallback((key: string, vars?: TranslationVars) => translate(locale, key, vars), [locale]);
  return { t, locale };
}
