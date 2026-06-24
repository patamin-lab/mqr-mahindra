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
