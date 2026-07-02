import { MqrRecord } from './types';
import { formatDateTimeLocalized } from './thaiDate';
import { translate } from './i18n/translate';
import { Locale } from './i18n/types';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** A cell starting with one of these is a potential CSV/formula-injection
 *  vector: Excel/Sheets evaluate a cell beginning with `=`/`+`/`-`/`@` (or
 *  tab/CR, which can smuggle one of those after leading whitespace) as a
 *  formula when the file is opened - a well-known CSV export
 *  vulnerability class distinct from plain comma/quote escaping. Any
 *  free-text field a technician/customer can influence (name, notes,
 *  RCA text) is a realistic injection point, so this applies to every
 *  cell, not just specific columns. */
const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string): string {
  const safe = FORMULA_INJECTION_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Builds a UTF-8 (with a leading BOM, so Excel on Windows correctly
 * detects the encoding instead of mis-rendering Thai text as mojibake)
 * CSV buffer with CRLF line endings, matching Excel's own convention.
 * Shared by every module's CSV export (MQR, PM) instead of each
 * hand-rolling its own writer/escaping logic.
 */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): Buffer {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsvCell(c.header)).join(','));
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = c.value(row);
          return escapeCsvCell(v === null || v === undefined ? '' : String(v));
        })
        .join(',')
    );
  }
  const body = lines.join('\r\n');
  return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(body, 'utf8')]);
}

function problemSystemLabel(s: string | null, locale: Locale): string {
  if (s === 'powertrain') return translate(locale, 'pdf.powertrainSystem');
  if (s) return translate(locale, 'pdf.otherSystem');
  return '';
}

/** Column headers follow the selected locale (Task 10 requirement 6) -
 *  mirrors exportExcel.ts's LIST_COLUMNS header set, so CSV/Excel exports
 *  of the same records list stay column-for-column consistent regardless
 *  of language. */
function mqrCsvColumns(locale: Locale): CsvColumn<MqrRecord>[] {
  return [
    { header: translate(locale, 'csv.reportNumber'), value: (r) => r.job_id },
    { header: translate(locale, 'csv.foundDate'), value: (r) => r.found_date },
    { header: translate(locale, 'csv.model'), value: (r) => r.model },
    { header: translate(locale, 'csv.serial'), value: (r) => r.serial },
    { header: translate(locale, 'csv.customerName'), value: (r) => r.customer_name },
    { header: translate(locale, 'csv.customerPhone'), value: (r) => r.customer_phone },
    { header: translate(locale, 'csv.problemCode'), value: (r) => r.problem_code },
    { header: translate(locale, 'csv.problemSystem'), value: (r) => problemSystemLabel(r.problem_system, locale) },
    { header: translate(locale, 'csv.hours'), value: (r) => r.hours },
    { header: translate(locale, 'csv.warrantyStatus'), value: (r) => r.warranty_status },
    { header: translate(locale, 'csv.jobStatus'), value: (r) => translate(locale, `mqrStatus.${r.status}`) },
    { header: translate(locale, 'csv.reporterName'), value: (r) => r.reporter_name },
    { header: translate(locale, 'csv.cause'), value: (r) => r.cause },
    { header: translate(locale, 'csv.damagedParts'), value: (r) => r.damaged_parts },
    { header: translate(locale, 'csv.createdBy'), value: (r) => r.user_name },
    { header: translate(locale, 'csv.createdAt'), value: (r) => (r.created_at ? formatDateTimeLocalized(r.created_at, locale) : '') },
  ];
}

export function buildRecordsCsv(records: MqrRecord[], locale: Locale = 'th'): Buffer {
  return buildCsv(records, mqrCsvColumns(locale));
}
