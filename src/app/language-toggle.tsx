'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n/types';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

const GOOGTRANS_COOKIE = 'googtrans';

function setGoogTransCookie(lang: 'th' | 'en') {
  document.cookie = `${GOOGTRANS_COOKIE}=/th/${lang}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function clearGoogTransCookie() {
  document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0`;
}

// Drives Google's own (hidden) language <select> directly — the reliable
// way to trigger the Website Translator widget programmatically, since the
// cookie alone only auto-applies when autoDisplay is enabled (which would
// also force-show Google's banner UI).
function applyLegacyGoogleTranslate(target: 'en', attempt = 0) {
  const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (combo) {
    combo.value = target;
    combo.dispatchEvent(new Event('change'));
    return;
  }
  if (attempt < 40) {
    setTimeout(() => applyLegacyGoogleTranslate(target, attempt + 1), 250);
  }
}

/**
 * TH/EN switch. The real language switch is `LocaleProvider`'s
 * `app_locale` cookie/context (drives the dictionary-based `t()` used
 * throughout the app — see `lib/i18n/`), which this component now
 * controls via `useLocale().setLocale()`.
 *
 * Google's free Website Translator widget (the *previous* implementation
 * of this toggle) is kept running alongside it, purely as a transitional
 * fallback for whatever UI text hasn't been migrated to
 * `src/locales/*.json` yet — it no longer has any say over PDF/CSV
 * output, validation messages, standardized terminology, or dates, all
 * of which now read the real `locale` directly. Already-migrated regions
 * are wrapped `notranslate` (see `globals.css`/individual components) so
 * Google's widget never re-translates text that's already correct.
 *
 * Same trigger button, same position (top-left on mobile, top-right on
 * desktop) as before — only the underlying mechanism changed, per the
 * explicit instruction to preserve the existing toggle's UI/UX.
 */
export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const googleInitialized = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Bring the legacy Google widget in sync with whatever locale we
  // started on (e.g. a returning visitor whose app_locale cookie is
  // already 'en') so any not-yet-migrated text is translated too.
  useEffect(() => {
    if (googleInitialized.current) return;
    googleInitialized.current = true;

    if (document.getElementById('google-translate-script')) {
      if (locale === 'en') applyLegacyGoogleTranslate('en');
      return;
    }

    window.googleTranslateElementInit = function () {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'th', includedLanguages: 'en,th', autoDisplay: false },
          'google_translate_element'
        );
      }
      if (locale === 'en') applyLegacyGoogleTranslate('en');
    };

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
    // Only ever needs to run once per page load, regardless of later locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  function handleSelect(target: Locale) {
    setOpen(false);
    if (target === locale) return;

    // Real switch — drives every migrated string, PDF/CSV, dates,
    // validation messages, terminology.
    setLocale(target);

    // Best-effort legacy fallback for whatever isn't migrated yet.
    if (target === 'th') {
      clearGoogTransCookie();
      // Selecting the original language back via Google's combo isn't
      // always clean, so a full reload restores pristine (untranslated)
      // Thai for any lingering Google-translated DOM nodes. The real
      // locale (app_locale cookie, already written above) survives the
      // reload, so this is not a loss of the actual language switch.
      window.location.reload();
      return;
    }
    setGoogTransCookie('en');
    applyLegacyGoogleTranslate('en');
  }

  return (
    <div
      ref={rootRef}
      className="notranslate fixed z-[60] top-14 left-3 md:top-3 md:left-auto md:right-3 print:hidden"
      translate="no"
    >
      <div id="google_translate_element" className="hidden" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="เปลี่ยนภาษา / Change language"
        className="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur shadow-card border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 010 18 14.5 14.5 0 010-18z" />
        </svg>
        {locale === 'th' ? 'ไทย' : 'EN'}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`absolute left-0 mt-1.5 w-28 rounded-xl bg-white shadow-card border border-gray-200 overflow-hidden origin-top transition-all duration-200 ${
          open ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => handleSelect('th')}
          className={`w-full text-left px-3 py-2 text-xs font-semibold transition ${
            locale === 'th' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          ไทย
        </button>
        <button
          type="button"
          onClick={() => handleSelect('en')}
          className={`w-full text-left px-3 py-2 text-xs font-semibold transition ${
            locale === 'en' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
