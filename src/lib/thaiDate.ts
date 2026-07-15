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
 *  independent of the server's own timezone. Exported for callers that need
 *  a Bangkok-local day boundary (not just a formatted display string) - e.g.
 *  `lib/db.ts`'s `listTodaysAuditLog()`, which needs "today" to mean the
 *  Thailand calendar day, not the server's UTC day. */
export function bangkokDateParts(value: string | number | Date): { day: number; month: number; year: number } {
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

/** Production Pilot Timestamp Standard (platform-wide): every full
 *  timestamp (created/updated/audit-log moment - as opposed to a pure
 *  business date like `delivery_date`/`performed_date`, which stays
 *  locale-varying via `formatDateLocalized()`) always renders as
 *  `dd/MMM/yyyy hh:mm:ss a` in Thailand local time, regardless of UI
 *  language - e.g. "15/Jul/2026 09:45:18 AM". `locale` is accepted but
 *  intentionally unused: every one of this function's ~13 call sites
 *  already treats its return value as "the" timestamp display, so the
 *  format changed here rather than forking a second function and
 *  updating every caller. */
export function formatDateTimeLocalized(value: string | number | Date, _locale: 'th' | 'en'): string {
  const d = value instanceof Date ? value : new Date(value);
  const { day, month, year } = bangkokDateParts(d);
  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGKOK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => timeParts.find((p) => p.type === type)?.value ?? '';
  const dd = String(day).padStart(2, '0');
  const mmm = ENGLISH_MONTHS_SHORT[month - 1];
  const hh = get('hour').padStart(2, '0');
  const mm = get('minute');
  const ss = get('second');
  const ampm = get('dayPeriod').toUpperCase();
  return `${dd}/${mmm}/${year} ${hh}:${mm}:${ss} ${ampm}`;
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
