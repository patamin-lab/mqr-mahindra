/**
 * Universal Import Framework — generic sheet reader.
 *
 * Reads an uploaded .xlsx/.csv file down to a plain header row + raw data
 * rows (both as trimmed strings) - it has no knowledge of any module's
 * business fields; `ColumnMappingService` and the module's own row-builder
 * take it from here. Reused as-is by every module - this file is the
 * "parser logic" the spec says never to modify per-module; only field
 * *coercion* (via each `ImportFieldDefinition.parse`) is module-specific.
 */
import ExcelJS from 'exceljs';

export interface ParsedSheet {
  headerRow: string[];
  /** Data rows only (header already excluded), 1 spreadsheet-row-numbered,
   *  fully-blank rows dropped, and nothing past the last row that has any
   *  non-empty cell (a sheet formatted/filled far beyond its real data
   *  should not produce thousands of empty rows). */
  dataRows: { row: number; cells: string[] }[];
}

/** Safely stringifies one ExcelJS cell value. Never falls through to a
 *  bare `String(cell)` for a non-primitive - that produces the literal
 *  text "[object Object]" for rich-text/hyperlink/formula-result objects
 *  ExcelJS can return, which must never be mistaken for real data (this is
 *  the exact defect class the spec calls out: "Ignore [object Object]"). */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
    }
    if ('text' in value) return String((value as { text: unknown }).text ?? '');
    if ('result' in value) return String((value as { result: unknown }).result ?? '');
    if ('hyperlink' in value) return String((value as { hyperlink: unknown }).hyperlink ?? '');
    return '';
  }
  return String(value);
}

/** Minimal RFC-4180-ish line splitter: quoted fields, doubled-quote
 *  escaping, comma delimiter - not a general CSV library, sufficient for
 *  a fixed-template import tool. */
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

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => c.trim() === '');
}

function parseCsv(buffer: Buffer): ParsedSheet {
  const text = buffer.toString('utf-8').replace(/^﻿/, '');
  const lines = text.split(/\r\n|\n/);
  const headerRow = lines.length > 0 ? parseCsvLine(lines[0]) : [];
  const dataRows: ParsedSheet['dataRows'] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const cells = parseCsvLine(lines[i]).map((c) => c.trim());
    if (isBlankRow(cells)) continue;
    dataRows.push({ row: i + 1, cells });
  }
  return { headerRow: headerRow.map((h) => h.trim()), dataRows };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  // The Import Wizard template names its data sheet "Data" - prefer it if
  // present (a template downloaded from Step 1), otherwise fall back to
  // the first worksheet (a bare spreadsheet someone built by hand).
  const sheet = wb.getWorksheet('Data') ?? wb.worksheets[0];
  if (!sheet) return { headerRow: [], dataRows: [] };

  const headerRow: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    headerRow.push(cellToString(cell.value).trim());
  });

  const dataRows: ParsedSheet['dataRows'] = [];
  let lastNonEmptyIndex = -1;
  const collected: { row: number; cells: string[] }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const width = headerRow.length;
    const cells: string[] = [];
    for (let col = 1; col <= width; col++) {
      cells.push(cellToString(row.getCell(col).value).trim());
    }
    if (isBlankRow(cells)) return;
    collected.push({ row: rowNumber, cells });
    lastNonEmptyIndex = collected.length - 1;
  });
  // "Stop at last non-empty row" - trailing blank-looking rows (already
  // filtered above) can't appear, but this guards against a sheet whose
  // formatting extends far past its real data producing sparse rows that
  // aren't fully blank (e.g. a stray space in one cell).
  for (let i = 0; i <= lastNonEmptyIndex; i++) dataRows.push(collected[i]);

  return { headerRow, dataRows };
}

export async function parseImportFile(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCsv(buffer);
  return parseXlsx(buffer);
}
