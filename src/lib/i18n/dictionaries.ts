import th from '@/locales/th.json';
import en from '@/locales/en.json';
import { Locale } from './types';

/** The Thai dictionary is the shape of record - every other locale's
 *  dictionary must structurally match it (same namespaces, same keys).
 *  `en satisfies Dictionary` below fails to compile if `en.json` is
 *  missing a key `th.json` has, catching an incomplete translation at
 *  build time rather than a silent runtime fallback. */
export type Dictionary = typeof th;

const enChecked = en satisfies Dictionary;

const DICTIONARIES: Record<Locale, Dictionary> = {
  th,
  en: enChecked,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
