import { getDictionary } from './dictionaries';
import { DEFAULT_LOCALE, Locale, TranslationVars } from './types';

/** Resolves a dotted key path ("pdf.mqrTitle") against a nested dictionary object. */
function resolvePath(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);
}

function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Core translation lookup, shared by both the server (`server.ts`'s `t()`)
 * and the client (`LocaleProvider.tsx`'s `useTranslation()`) — the only
 * place a dotted key is ever resolved against a dictionary, so both call
 * sites behave identically.
 *
 * Falls back to the default locale's value if the requested locale is
 * missing the key (shouldn't happen given `dictionaries.ts`'s compile-time
 * shape check, but stays defensive for a key typo), then to the raw key
 * itself as a last resort — a missing translation is visible as a
 * literal `namespace.key` string in the UI rather than a blank/crash,
 * making it easy to spot during review.
 */
export function translate(locale: Locale, key: string, vars?: TranslationVars): string {
  const value = resolvePath(getDictionary(locale), key);
  if (typeof value === 'string') return interpolate(value, vars);

  if (locale !== DEFAULT_LOCALE) {
    const fallback = resolvePath(getDictionary(DEFAULT_LOCALE), key);
    if (typeof fallback === 'string') return interpolate(fallback, vars);
  }

  return key;
}
