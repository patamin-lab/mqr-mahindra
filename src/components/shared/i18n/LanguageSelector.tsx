'use client';

/**
 * TH/EN switch - the ONE shared implementation, embedded wherever a
 * language control is needed (the authenticated app's `PlatformHeader`,
 * and the login page) rather than a floating page-level button. Replaces
 * the old `app/language-toggle.tsx`, which combined this UI with a fixed
 * `position: fixed` wrapper - that positioning is gone; the caller decides
 * placement via normal layout flow.
 *
 * The real language switch is `LocaleProvider`'s `app_locale` cookie/
 * context (drives the dictionary-based `t()` used throughout the app),
 * via `useLocale().setLocale()`. Google's free Website Translator widget
 * (the *previous* implementation of this toggle, before `LocaleProvider`
 * existed) is kept running alongside it, purely as a transitional fallback
 * for whatever UI text hasn't been migrated to `src/locales/*.json` yet -
 * bootstrapped once, invisibly, by `GoogleTranslateBridge` in the root
 * layout. Already-migrated regions are wrapped `notranslate` so Google's
 * widget never re-translates text that's already correct.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n/types';
import { applyLegacyGoogleTranslate, clearGoogTransCookie, setGoogTransCookie } from './googleTranslateHelpers';

export interface LanguageSelectorProps {
  /** 'header' (default) matches the light-on-dark PlatformHeader chrome;
   *  'card' matches a white-card surface like the login page. */
  variant?: 'header' | 'card';
  className?: string;
}

export default function LanguageSelector({ variant = 'header', className }: LanguageSelectorProps) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

    setLocale(target);

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

  const buttonClass =
    variant === 'header'
      ? 'flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-white'
      : 'flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur shadow-card border border-gray-200 px-3 py-1.5 text-xs font-semibold text-brand-dark';

  return (
    <div ref={rootRef} className={`notranslate relative print:hidden ${className ?? ''}`} translate="no">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="เปลี่ยนภาษา / Change language"
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClass}
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
        role="menu"
        className={`absolute right-0 mt-1.5 w-28 rounded-xl bg-white shadow-card border border-gray-200 overflow-hidden origin-top-right transition-all duration-200 z-50 ${
          open ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
        }`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => handleSelect('th')}
          className={`w-full text-left px-3 py-2 text-xs font-semibold transition ${
            locale === 'th' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          ไทย
        </button>
        <button
          type="button"
          role="menuitem"
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
