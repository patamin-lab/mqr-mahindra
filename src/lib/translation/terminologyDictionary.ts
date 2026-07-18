/**
 * Engineering terminology normalization (Defect 2). Generic machine
 * translation alone is insufficient for a cross-country engineering
 * report - a tractor part name translated word-for-word by a general-
 * purpose model frequently misses the actual industry term. This table is
 * applied to the Thai SOURCE text before it reaches a
 * `MachineTranslationProvider` (see `translationService.ts`), never as a
 * post-process over the provider's own output - a real translator (e.g.
 * Google Cloud Translation) returns fully English text with no Thai
 * substrings left in it, so matching this table against a translation
 * result can never find anything to fix. Pre-substituting means the
 * approved English term is what the provider actually sees/passes
 * through, not something reconstructed after the fact.
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
 * word, expand it, or alter its casing). Held back with a placeholder
 * before a provider call (`protectAcronyms`) and restored verbatim
 * afterward (`restoreAcronyms`) - a guaranteed round-trip, unlike the
 * terminology table above which relies on the provider passing an
 * already-English phrase through mostly unchanged.
 */
export const PROTECTED_ACRONYMS: ReadonlyArray<string> = ['PTO', 'RPM', 'ECU', 'CAN', 'VIN', 'ABS', '4WD', '2WD'];

/** Longest-match-first so e.g. "เพลาส่งกำลัง" is matched whole, never as
 *  "เพลา" + leftover text. */
const SORTED_TERMS = [...ENGINEERING_TERMINOLOGY].sort((a, b) => b.th.length - a.th.length);

/**
 * Applies the terminology table directly to Thai source text, replacing
 * every known term with its normalized English form in place, before
 * that text is ever sent to a `MachineTranslationProvider`. This is
 * intentionally a narrow, literal find-and-replace over ONLY the terms
 * above - not a translator - and doubles as the entire normalization when
 * no provider is configured, so a recognizable term still surfaces
 * correctly even with live translation unavailable.
 */
export function applyTerminologyNormalization(text: string): string {
  let result = text;
  for (const { th, en } of SORTED_TERMS) {
    result = result.split(th).join(en);
  }
  return result;
}

/** Longest-match-first for the same reason as terminology above (e.g.
 *  "4WD" must never be caught mid-match by a shorter, unrelated
 *  acronym). */
const SORTED_ACRONYMS = [...PROTECTED_ACRONYMS].sort((a, b) => b.length - a.length);

/**
 * Replaces every occurrence of a protected acronym with a unique
 * placeholder token before the text is sent to a translation provider,
 * and returns a `restore` function that puts the original acronym back
 * verbatim afterward. The placeholder shape (`@@P0@@`) uses characters no
 * legitimate engineering free-text field would contain, and is
 * distinctive enough that a translation provider passes it through
 * unmodified rather than "translating" it.
 */
export function protectAcronyms(text: string): { text: string; restore: (translated: string) => string } {
  let working = text;
  const replacements: { placeholder: string; original: string }[] = [];
  SORTED_ACRONYMS.forEach((acronym, index) => {
    if (!working.includes(acronym)) return;
    const placeholder = `@@P${index}@@`;
    working = working.split(acronym).join(placeholder);
    replacements.push({ placeholder, original: acronym });
  });
  return {
    text: working,
    restore: (translated: string) => replacements.reduce((t, { placeholder, original }) => t.split(placeholder).join(original), translated),
  };
}
