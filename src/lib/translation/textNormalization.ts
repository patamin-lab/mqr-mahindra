/**
 * Text normalization (Defect 2): whitespace/line-break/bullet/numbering
 * cleanup, and unit-preserving substitution for the small set of Thai
 * unit words that appear in free-text fields (e.g. "20 ชั่วโมง" -> "20
 * hours"). This is NOT a translator - it's a narrow, literal substitution
 * over an explicit, exact list, same discipline as
 * `terminologyDictionary.ts` and for the same reason: a wrong unit in an
 * official engineering report is worse than an untranslated one.
 */
const UNIT_WORDS: ReadonlyArray<{ th: string; en: string }> = [
  { th: 'ชั่วโมง', en: 'hours' },
  { th: 'นาที', en: 'minutes' },
  { th: 'มม.', en: 'mm' },
  { th: 'ซม.', en: 'cm' },
  { th: 'กม.', en: 'km' },
  { th: 'กก.', en: 'kg' },
  { th: 'ลิตร', en: 'liters' },
  { th: 'วัน', en: 'days' },
];

const SORTED_UNITS = [...UNIT_WORDS].sort((a, b) => b.th.length - a.th.length);

/** Replaces a known Thai unit word directly following a number with its
 *  English form (e.g. "5 มม." -> "5 mm") - deliberately anchored to
 *  "number + unit" so a unit word appearing as ordinary prose text isn't
 *  mistranslated in isolation. */
export function normalizeUnits(text: string): string {
  let result = text;
  for (const { th, en } of SORTED_UNITS) {
    // number, optional whitespace, the Thai unit word
    const pattern = new RegExp(`(\\d)\\s*${th.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    result = result.replace(pattern, `$1 ${en}`);
  }
  return result;
}

/** Whitespace/line-break/bullet/numbering cleanup - collapses runs of
 *  blank lines, trims trailing whitespace per line, and normalizes a few
 *  common bullet glyphs (•, -, *) to a single consistent "- " prefix so a
 *  PDF page doesn't inherit inconsistent spacing/bullet styles from
 *  whatever the original form input happened to produce. Never alters
 *  the actual words/characters of the text. */
export function normalizeWhitespaceAndLists(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, '').replace(/^[ \t]+/, ''))
    .map((line) => line.replace(/^[•*]\s*/, '- '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
