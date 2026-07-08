/**
 * Shared logic for the legacy Google Website Translator fallback - split
 * out from the old `app/language-toggle.tsx` so both `GoogleTranslateBridge`
 * (the invisible, once-per-app bootstrap) and `LanguageSelector` (the
 * visible embeddable dropdown) can use it without duplicating the cookie/
 * combo-box-driving logic. See `LanguageSelector.tsx`'s doc comment for
 * why this fallback still exists alongside the real `LocaleProvider`
 * switch.
 */

export const GOOGTRANS_COOKIE = 'googtrans';

export function setGoogTransCookie(lang: 'th' | 'en') {
  document.cookie = `${GOOGTRANS_COOKIE}=/th/${lang}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export function clearGoogTransCookie() {
  document.cookie = `${GOOGTRANS_COOKIE}=; path=/; max-age=0`;
}

/** Drives Google's own (hidden) language `<select>` directly - the
 *  reliable way to trigger the Website Translator widget programmatically,
 *  since the cookie alone only auto-applies when `autoDisplay` is enabled
 *  (which would also force-show Google's banner UI). */
export function applyLegacyGoogleTranslate(target: 'en', attempt = 0) {
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
