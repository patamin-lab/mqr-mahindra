/**
 * NTR — Legacy Import result report (`NTR_IMPORT_RESULT.xlsx`).
 *
 * Reuses the same ExcelJS conventions as `ntrExcel.ts`
 * (bold+shaded header row, frozen header, autofilter) rather than a
 * second Excel-building approach. Every original column from the
 * uploaded file is preserved, in the same order as `NTR_IMPORT_FIELDS`,
 * with `Status`/`Error Message`/`Warning` appended - so a dealer can fix
 * the flagged rows in this same file and re-upload it directly, per
 * "a downloadable Excel error report that can be corrected and imported
 * again."
 */
import ExcelJS from 'exceljs';
import { NTR_IMPORT_FIELDS } from './ntrImportFields';
import { NtrImportRow, NtrImportRowResult } from '../types';
import { ImportWarning } from '@/shared/import';

function cellValue(row: NtrImportRow, canonicalKey: string): string | number {
  const value = (row as unknown as Record<string, unknown>)[canonicalKey];
  if (value === null || value === undefined) return '';
  return value as string | number;
}

export async function buildNtrImportResultWorkbook(
  rows: NtrImportRow[],
  results: NtrImportRowResult[],
  warnings: ImportWarning[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MASP - NTR Legacy Import';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Import Result');

  const warningsByRow = new Map<number, string[]>();
  for (const w of warnings) {
    const existing = warningsByRow.get(w.row) ?? [];
    existing.push(w.message);
    warningsByRow.set(w.row, existing);
  }
  const resultByRow = new Map(results.map((r) => [r.row, r]));

  sheet.columns = [
    ...NTR_IMPORT_FIELDS.map((f) => ({ header: f.displayLabel, key: f.canonicalKey, width: 18 })),
    { header: 'Status', key: '__status', width: 14 },
    { header: 'Error Message', key: '__error', width: 40 },
    { header: 'Warning', key: '__warning', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    const result = resultByRow.get(row.row);
    const rowData: Record<string, string | number> = {};
    for (const field of NTR_IMPORT_FIELDS) rowData[field.canonicalKey] = cellValue(row, field.canonicalKey);
    rowData.__status = result?.outcome ?? '';
    rowData.__error = result?.outcome === 'failed' || result?.outcome === 'duplicate' ? result.reason ?? '' : '';
    rowData.__warning = (warningsByRow.get(row.row) ?? []).join('; ');
    sheet.addRow(rowData);
  }

  const lastColumnIndex = NTR_IMPORT_FIELDS.length + 3;
  sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(lastColumnIndex).letter}1` };

  return wb.xlsx.writeBuffer();
}
