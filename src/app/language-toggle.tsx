'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

const COOKIE_NAME = 'googtrans';

function readLangFromCookie(): 'th' | 'en' {
  if (typeof document === 'undefined') return 'th';
  const match = document.cookie.match(/googtrans=\/[^/]+\/([a-zA-Z-]+)/);
  return match && match[1] === 'en' ? 'en' : 'th';
}

function setLangCookie(lang: 'th' | 'en') {
  if (lang === 'th') {
    // Clearing the cookie restores the original Thai content.
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  } else {
    document.cookie = `${COOKIE_NAME}=/th/en; path=/; max-age=86400`;
  }
}

// Lightweight TH/EN switch built on the free, unofficial Google Translate
// Element widget. We keep Google's own dropdown UI hidden (see globals.css)
// and drive it ourselves via the documented `googtrans` cookie convention,
// then reload so the widget translates the freshly-rendered page.
export default function LanguageToggle() {
  const [lang, setLang] = useState<'th' | 'en'>('th');

  useEffect(() => {
    setLang(readLangFromCookie());

    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = function () {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'th', includedLanguages: 'en,th', autoDisplay: false },
          'google_translate_element'
        );
      }
    };

    const script = document.createElement('script');
    script.id = 'google-translate-script';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function handleSelect(target: 'th' | 'en') {
    if (target === lang) return;
    setLangCookie(target);
    window.location.reload();
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
