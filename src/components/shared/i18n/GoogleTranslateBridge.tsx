'use client';

/**
 * Invisible, mount-once bootstrap for the legacy Google Website Translator
 * fallback (see `LanguageSelector.tsx`'s doc comment). Renders no visible
 * UI - just the hidden `google_translate_element` div and the widget
 * script - so it belongs once in the root layout, on every page including
 * `/login` (unauthenticated pages still benefit from the fallback for any
 * not-yet-migrated string). The actual visible language switch is
 * `LanguageSelector`, embedded wherever a language control is needed
 * (the authenticated app's `PlatformHeader`, and the login page).
 */
import { useEffect, useRef } from 'react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { applyLegacyGoogleTranslate } from './googleTranslateHelpers';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

export default function GoogleTranslateBridge() {
  const { locale } = useLocale();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

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

  return <div id="google_translate_element" className="hidden notranslate" translate="no" />;
}
