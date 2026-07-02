import { MqrRecord } from './types';
import { formatThaiDateTime } from './thaiDate';

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
 * Shared by every module's CSV export (MQR today, PM next) instead of
 * each hand-rolling its own writer/escaping logic.
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

function problemSystemLabel(s: string | null) {
  if (s === 'powertrain') return 'Powertrain (48 เดือน)';
  if (s) return 'อื่นๆ (24 เดือน)';
  return '';
}

/** Mirrors exportExcel.ts's LIST_COLUMNS header set, so the CSV and Excel
 *  exports of the same records list are column-for-column consistent. */
const MQR_CSV_COLUMNS: CsvColumn<MqrRecord>[] = [
  { header: 'เลขที่งาน', value: (r) => r.job_id },
  { header: 'วันที่พบปัญหา', value: (r) => r.found_date },
  { header: 'รุ่นรถ', value: (r) => r.model },
  { header: 'หมายเลขรถ', value: (r) => r.serial },
  { header: 'ลูกค้า', value: (r) => r.customer_name },
  { header: 'เบอร์โทรลูกค้า', value: (r) => r.customer_phone },
  { header: 'อาการ', value: (r) => r.problem_code },
  { header: 'ระบบ', value: (r) => problemSystemLabel(r.problem_system) },
  { header: 'ชั่วโมงการใช้งาน', value: (r) => r.hours },
  { header: 'สถานะการรับประกัน', value: (r) => r.warranty_status },
  { header: 'สถานะงาน', value: (r) => r.status },
  { header: 'ผู้แจ้ง', value: (r) => r.reporter_name },
  { header: 'สาเหตุ', value: (r) => r.cause },
  { header: 'อะไหล่ที่เสียหาย', value: (r) => r.damaged_parts },
  { header: 'ผู้บันทึก', value: (r) => r.user_name },
  { header: 'วันที่บันทึก', value: (r) => (r.created_at ? formatThaiDateTime(r.created_at) : '') },
];

export function buildRecordsCsv(records: MqrRecord[]): Buffer {
  return buildCsv(records, MQR_CSV_COLUMNS);
}
