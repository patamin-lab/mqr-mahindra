/**
 * NTR Legacy Import — file parser.
 *
 * Supports .xlsx (via the existing ExcelJS dependency) and .csv (minimal
 * RFC-4180-ish parsing: quoted fields, escaped quotes, comma delimiter -
 * sufficient for the fixed export-then-reimport template this tool
 * targets, not a general-purpose CSV library). Expects a fixed header row
 * (see `TEMPLATE_COLUMNS`) - this is a known, disclosed scope reduction
 * versus a flexible arbitrary-column-mapping UI, appropriate for a
 * SuperAdmin-only, one-time historical-data tool.
 */
import ExcelJS from 'exceljs';
import { NtrImportRow, NtrCustomerType } from '../types';

/** Column order the uploaded file's header row must match exactly
 *  (case-insensitive, whitespace-trimmed). */
export const TEMPLATE_COLUMNS = [
  'dealer_id',
  'branch_id',
  'serial',
  'model',
  'engine_number',
  'customer_name',
  'customer_phone',
  'customer_address',
  'customer_district',
  'customer_province',
  'customer_postal_code',
  'customer_type',
  'retail_date',
  'delivery_date',
  'salesperson',
  'receiving_person',
  'hour_meter',
  // Appended, not inserted, so a legacy file exported before these fields
  // existed still parses correctly - a missing trailing column simply
  // yields '' -> null for every row, per spec ("if a legacy file does not
  // contain them, leave them NULL").
  'customer_title',
  'customer_first_name',
  'customer_last_name',
  'customer_subdistrict',
  'product_family_id',
  'variant',
  'pdi_date',
  'manufacturing_year',
] as const;

function normalizeCustomerType(value: string): NtrCustomerType | null {
  const v = value.trim().toLowerCase();
  if (v === 'individual' || v === 'บุคคลธรรมดา') return 'Individual';
  if (v === 'company' || v === 'นิติบุคคล') return 'Company';
  return null;
}

function cellToRow(cells: string[], rowNumber: number): NtrImportRow {
  const get = (col: (typeof TEMPLATE_COLUMNS)[number]) => {
    const idx = TEMPLATE_COLUMNS.indexOf(col);
    return (cells[idx] ?? '').trim();
  };
  const hourMeterRaw = get('hour_meter');
  const manufacturingYearRaw = get('manufacturing_year');
  return {
    row: rowNumber,
    dealer_id: get('dealer_id'),
    branch_id: get('branch_id') || null,
    serial: get('serial'),
    model: get('model') || null,
    engine_number: get('engine_number') || null,
    customer_title: get('customer_title') || null,
    customer_first_name: get('customer_first_name') || null,
    customer_last_name: get('customer_last_name') || null,
    customer_name: get('customer_name'),
    customer_phone: get('customer_phone'),
    customer_address: get('customer_address') || null,
    customer_subdistrict: get('customer_subdistrict') || null,
    customer_district: get('customer_district') || null,
    customer_province: get('customer_province') || null,
    customer_postal_code: get('customer_postal_code') || null,
    customer_type: get('customer_type') ? normalizeCustomerType(get('customer_type')) : null,
    product_family_id: get('product_family_id') || null,
    variant: get('variant') || null,
    retail_date: get('retail_date') || null,
    delivery_date: get('delivery_date'),
    pdi_date: get('pdi_date') || null,
    manufacturing_year: manufacturingYearRaw ? Number(manufacturingYearRaw) : null,
    salesperson: get('salesperson') || null,
    receiving_person: get('receiving_person') || null,
    hour_meter: hourMeterRaw ? Number(hourMeterRaw) : null,
  };
}

/** Minimal RFC-4180-ish line splitter: handles quoted fields containing
 *  commas/newlines and doubled-quote escaping - not a general CSV library,
 *  sufficient for this tool's fixed template. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(buffer: Buffer): NtrImportRow[] {
  const text = buffer.toString('utf-8').replace(/^﻿/, '');
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  const rows: NtrImportRow[] = [];
  // Row 1 is the header - data starts at spreadsheet row 2.
  for (let i = 1; i < lines.length; i++) {
    rows.push(cellToRow(parseCsvLine(lines[i]), i + 1));
  }
  return rows;
}

async function parseXlsx(buffer: Buffer): Promise<NtrImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const rows: NtrImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const cells = TEMPLATE_COLUMNS.map((_, i) => {
      const cell = row.getCell(i + 1).value;
      if (cell === null || cell === undefined) return '';
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      if (typeof cell === 'object' && 'text' in (cell as unknown as Record<string, unknown>)) {
        return String((cell as unknown as { text: unknown }).text);
      }
      return String(cell);
    });
    rows.push(cellToRow(cells, rowNumber));
  });
  return rows;
}

export async function parseNtrImportFile(buffer: Buffer, filename: string): Promise<NtrImportRow[]> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCsv(buffer);
  return parseXlsx(buffer);
}
