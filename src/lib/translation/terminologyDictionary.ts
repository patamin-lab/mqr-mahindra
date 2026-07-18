/**
 * Engineering terminology normalization (Defect 2). Generic machine
 * translation alone is insufficient for a cross-country engineering
 * report - a tractor part name translated word-for-word by a general-
 * purpose model frequently misses the actual industry term. This table
 * is applied as a normalization PASS on top of whatever
 * `MachineTranslationProvider` returns (see `translationService.ts`),
 * never as a replacement for real translation.
 *
 * IMPORTANT: this list is exactly the term set explicitly provided when
 * this feature was scoped. It is deliberately NOT expanded with
 * additional guessed terms - a wrong engineering term in an official
 * Mahindra Thailand <-> Mahindra India report is worse than a term left
 * untranslated. Expanding this table is real domain work that needs
 * sign-off from an actual service engineering SME, not something to
 * invent here. See the root PR report's "Remaining risks" for this
 * explicitly called out as follow-up work.
 */
export const ENGINEERING_TERMINOLOGY: ReadonlyArray<{ th: string; en: string }> = [
  { th: 'เพลาหน้า', en: 'Front Axle' },
  { th: 'เพลาหลัง', en: 'Rear Axle' },
  { th: 'ดุมล้อหน้า', en: 'Front Wheel Hub' },
  { th: 'ลูกปืน', en: 'Bearing' },
  { th: 'ซีลน้ำมัน', en: 'Oil Seal' },
  { th: 'กระบอกไฮดรอลิก', en: 'Hydraulic Cylinder' },
  { th: 'ปั๊มไฮดรอลิก', en: 'Hydraulic Pump' },
  { th: 'แขนยก', en: 'Lower Link' },
  { th: 'แขนบน', en: 'Top Link' },
  { th: 'เพลาส่งกำลัง', en: 'PTO Shaft' },
  { th: 'เฟืองท้าย', en: 'Final Drive' },
  { th: 'เกียร์', en: 'Gearbox' },
  { th: 'คลัตช์', en: 'Clutch' },
];

/**
 * Acronyms that must never be run through machine translation (a general
 * MT provider will sometimes "translate" an acronym into an unrelated
 * word or expand it incorrectly). Applied as a protect-list: these
 * substrings are held back before a provider call and restored verbatim
 * afterward.
 */
export const PROTECTED_ACRONYMS: ReadonlyArray<string> = ['PTO', 'RPM', 'ECU', 'CAN', 'VIN', 'ABS', '4WD', '2WD'];

/** Longest-match-first so e.g. "เพลาส่งกำลัง" is matched whole, never as
 *  "เพลา" + leftover text. */
const SORTED_TERMS = [...ENGINEERING_TERMINOLOGY].sort((a, b) => b.th.length - a.th.length);

/**
 * Applies the terminology table directly to Thai source text, replacing
 * every known term with its normalized English form in place. This is
 * intentionally a narrow, literal find-and-replace over ONLY the terms
 * above - not a translator. It runs both (a) as a normalization pass
 * over whatever a real `MachineTranslationProvider` returns, so a known
 * term is always rendered with the exact approved English term rather
 * than whatever a general-purpose model chose, and (b) standalone when no
 * provider is configured, so a recognizable term still surfaces correctly
 * even with translation otherwise unavailable.
 */
export function applyTerminologyNormalization(text: string): string {
  let result = text;
  for (const { th, en } of SORTED_TERMS) {
    result = result.split(th).join(en);
  }
  return result;
}
