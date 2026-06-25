'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

const COOKIE_NAME = 'googtrans';

function setLangCookie(lang: 'th' | 'en') {
  document.cookie = `${COOKIE_NAME}=/th/${lang}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function clearLangCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

function readLangFromCookie(): 'th' | 'en' {
  if (typeof document === 'undefined') return 'th';
  const match = document.cookie.match(/googtrans=\/[^/]+\/([a-zA-Z-]+)/);
  return match && match[1] === 'en' ? 'en' : 'th';
}

// Drives Google's own (hidden) language <select> directly — this is the
// documented, reliable way to trigger the Website Translator widget
// programmatically, since the cookie alone only auto-applies when
// autoDisplay is enabled (which would also force-show Google's banner UI).
function applyTranslation(target: 'en', attempt = 0) {
  const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (combo) {
    combo.value = target;
    combo.dispatchEvent(new Event('change'));
    return;
  }
  if (attempt < 40) {
    setTimeout(() => applyTranslation(target, attempt + 1), 250);
  }
}

// Lightweight TH/EN switch built on the free, unofficial Google Translate
// Element widget. Google's own dropdown UI stays hidden (see globals.css);
// we drive it ourselves by selecting its underlying <select> element.
export default function LanguageToggle() {
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const initialized = useRef(false);

  useEffect(() => {
    const cookieLang = readLangFromCookie();
    setLang(cookieLang);

    if (initialized.current) return;
    initialized.current = true;

    if (document.getElementById('google-translate-script')) {
      if (cookieLang === 'en') applyTranslation('en');
      return;
    }

    window.googleTranslateElementInit = function () {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'th', includedLanguages: 'en,th', autoDisplay: false },
          'google_translate_element'
        );
      }
      if (cookieLang === 'en') applyTranslation('en');
    };

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function handleSelect(target: 'th' | 'en') {
    if (target === lang) return;
    setLang(target);

    if (target === 'th') {
      // Selecting the original language back via the combo is not always
      // clean, so just clear the cookie and reload to restore pristine Thai.
      clearLangCookie();
      window.location.reload();
      return;
    }

    setLangCookie('en');
    applyTranslation('en');
  }

  return (
    <div
      className="notranslate fixed top-3 right-3 z-[60] flex items-center gap-1 rounded-full bg-white/95 backdrop-blur shadow-card border border-gray-200 p-1 print:hidden"
      translate="no"
    >
      <div id="google_translate_element" className="hidden" />
      <button
        type="button"
        onClick={() => handleSelect('th')}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
          lang === 'th' ? 'bg-gradient-primary text-white shadow-glow' : 'text-gray-500 hover:text-brand-dark'
        }`}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => handleSelect('en')}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
          lang === 'en' ? 'bg-gradient-primary text-white shadow-glow' : 'text-gray-500 hover:text-brand-dark'
        }`}
      >
        EN
      </button>
    </div>
  );
}
