/** Thai calendar helpers — used by the dashboard's year/month filter and labels.
 * We only ever convert *display* labels to พ.ศ.; all stored dates and SQL
 * filtering stay in Gregorian (ISO) form. */

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/** "2026-06" -> "มิ.ย. 2569" */
export function formatMonthKeyThai(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return `${THAI_MONTHS_SHORT[m - 1]} ${toBuddhistYear(y)}`;
}

/** Buddhist-era years that currently have at least one record, newest first,
 * always including the current year so the filter never looks empty. */
export function buildYearOptions(gregorianYearsWithData: number[]): { value: number; label: string }[] {
  const nowYear = new Date().getFullYear();
  const years = new Set(gregorianYearsWithData);
  years.add(nowYear);
  return Array.from(years)
    .sort((a, b) => b - a)
    .map((y) => ({ value: y, label: String(toBuddhistYear(y)) }));
}

/** Format any timestamp for display in Thailand local time (GMT+7), regardless
 * of the server's own timezone (Vercel runs in UTC). Used everywhere we show
 * a created/updated timestamp — PDF export, Excel export, audit trail, etc.
 * so stamps never drift by 7 hours from what actually happened in Thailand. */
const BANGKOK_TZ = 'Asia/Bangkok';

export function formatThaiDateTime(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString('th-TH', { timeZone: BANGKOK_TZ });
}

// ---------- Locale-aware formatting (src/lib/i18n) ----------
// Thai UI -> Buddhist-era date, full Thai month name ("01 กรกฎาคม 2569").
// English UI -> Gregorian date, short English month ("01 Jul 2026").
// Both always render in Thailand local time (GMT+7), regardless of which
// language is selected - only the calendar/month-name/year representation
// changes, never the underlying moment in time. See lib/i18n/ for the
// `Locale` type this takes.

const ENGLISH_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Parts (day/month/year) of `value` as they read in Thailand local time,
 *  independent of the server's own timezone. */
function bangkokDateParts(value: string | number | Date): { day: number; month: number; year: number } {
  const d = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get('day'), month: get('month'), year: get('year') };
}

/** Date-only, locale-aware: `01 กรกฎาคม 2569` (th) / `01 Jul 2026` (en). */
export function formatDateLocalized(value: string | number | Date, locale: 'th' | 'en'): string {
  const { day, month, year } = bangkokDateParts(value);
  const dd = String(day).padStart(2, '0');
  if (locale === 'th') {
    return `${dd} ${THAI_MONTHS_FULL[month - 1]} ${toBuddhistYear(year)}`;
  }
  return `${dd} ${ENGLISH_MONTHS_SHORT[month - 1]} ${year}`;
}

/** Full timestamp, locale-aware - same date representation as
 *  `formatDateLocalized()` plus a 24h time-of-day suffix. */
export function formatDateTimeLocalized(value: string | number | Date, locale: 'th' | 'en'): string {
  const d = value instanceof Date ? value : new Date(value);
  const datePart = formatDateLocalized(d, locale);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${datePart} ${timePart}`;
}

/** `YYYYMMDD_HHMM` in Thailand local time - for filenames (e.g.
 *  `MSEAL_DMS_Tractor_Registry_20260703_1430.xlsx`), never the server's own
 *  (UTC) clock, same GMT+7 rule as every other displayed/exported
 *  timestamp in this app. */
export function formatBangkokFilenameTimestamp(value: string | number | Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}`;
}
