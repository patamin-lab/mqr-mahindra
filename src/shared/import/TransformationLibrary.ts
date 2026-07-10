/**
 * Transformation Library (Import Platform v2, ADR-022).
 *
 * Named, reusable coercion primitives every `ImportFieldDefinition.parse`
 * should call instead of hand-rolling its own - NTR's own date/number/
 * string coercion (previously inline in `ntrImportFields.ts`) is now
 * implemented here once and imported back, not duplicated. A future
 * module's field definitions compose these same functions rather than
 * re-deriving them.
 *
 * Address normalization, Dealer alias resolution, and Model/Product
 * Family alias resolution are deliberately *not* reimplemented here as
 * generic string transforms - those are `ThailandAddressResolver`'s and
 * `MasterDataResolver`'s jobs respectively (both already reuse the real
 * Master Data these values must match against). Duplicating a simplified
 * version of that matching logic here would be exactly the "duplicated
 * resolver" this platform's own principles warn against.
 */

export const trim = (raw: string): string => raw.trim();

export const toUpperCase = (raw: string): string => raw.trim().toUpperCase();

export const toLowerCase = (raw: string): string => raw.trim().toLowerCase();

export const toStringOrNull = (raw: string): string | null => (raw.trim() ? raw.trim() : null);

export const toNumberOrNull = (raw: string): number | null => {
  const value = raw.trim();
  if (!value) return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
};

/** Recognizes common yes/no spellings (English and Thai) - anything else
 *  returns `null` (not a silent `false`), so an unrecognized value fails
 *  validation as missing/invalid rather than being stored as a guess. */
const TRUE_VALUES = new Set(['true', 'yes', 'y', '1', 'ใช่', 'จริง']);
const FALSE_VALUES = new Set(['false', 'no', 'n', '0', 'ไม่ใช่', 'ไม่จริง']);
export const toBooleanOrNull = (raw: string): boolean | null => {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return null;
};

/** Collapses internal whitespace runs to one space and trims - useful as
 *  a pre-pass before an exact-match comparison (not a display formatter). */
export const normalizeWhitespace = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Normalizes a date cell to ISO `YYYY-MM-DD` - the format every
 *  downstream consumer in this app assumes. Recognizes already-ISO
 *  dates, "31 Oct 2025"/"31 October 2025", "31/10/2025", and
 *  "31-10-2025". Returns `null` for anything else (an unparseable date
 *  fails validation as missing/invalid, never stored as garbage text) -
 *  moved here unchanged from `ntrImportFields.ts`'s original
 *  `parseImportDate()`, now the one shared implementation every module's
 *  date fields should call. */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmyName = value.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (dmyName) {
    const day = Number(dmyName[1]);
    const month = MONTH_NAMES[dmyName[2].toLowerCase()];
    const year = Number(dmyName[3]);
    if (!month || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const dmySlash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmySlash) {
    const day = Number(dmySlash[1]);
    const month = Number(dmySlash[2]);
    const year = Number(dmySlash[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}
