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

// Drives Google's own (hidden) language <select> directly — the reliable
// way to trigger the Website Translator widget programmatically, since the
// cookie alone only auto-applies when autoDisplay is enabled (which would
// also force-show Google's banner UI).
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
//
// Rendered as a small trigger button — top-left on mobile (so it never
// overlaps the sidebar's hamburger button, which sits top-right inside the
// mobile header bar) and top-right on desktop (no header bar there, so no
// collision). Tapping the trigger opens a dropdown panel that slides down
// from underneath it, instead of two buttons sitting permanently on screen.
export default function LanguageToggle() {
  const [lang, setLang] = useState<'th' | 'en'>('th');
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  function handleSelect(target: 'th' | 'en') {
    setOpen(false);
    if (target === lang) return;
    setLang(target);

    if (target === 'th') {
      // Selecting the original language back via the combo isn't always
      // clean, so clear the cookie and reload to restore pristine Thai.
      clearLangCookie();
      window.location.reload();
      return;
    }

    setLangCookie('en');
    applyTranslation('en');
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
        {lang === 'th' ? 'ไทย' : 'EN'}
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
            lang === 'th' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          ไทย
        </button>
        <button
          type="button"
          onClick={() => handleSelect('en')}
          className={`w-full text-left px-3 py-2 text-xs font-semibold transition ${
            lang === 'en' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
