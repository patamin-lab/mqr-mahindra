/**
 * Universal Import Framework — header validation (Step 2/3).
 *
 * Reads a template's `_META` sheet (when present - a plain .csv or a
 * hand-built .xlsx from before the Import Wizard existed has none, which
 * is expected, not an error) and validates required columns are present
 * after column mapping. Per spec: only required columns block import -
 * an absent optional column, or a `_META`-less file, is never a hard
 * failure on its own.
 */
import ExcelJS from 'exceljs';
import { ColumnMappingService } from './ColumnMappingService';
import { ImportContract } from './ImportContract';

export interface DetectedTemplateMeta {
  module: string | null;
  templateVersion: string | null;
  templateName: string | null;
}

/** Reads the `_META` sheet's Key/Value rows, if the uploaded file is an
 *  `.xlsx` produced by `buildImportTemplate()`. Returns all-null fields
 *  for a `.csv` upload or an `.xlsx` with no `_META` sheet - never throws
 *  on a missing sheet, since that's a normal, expected case (a legacy
 *  file predating the wizard, or a hand-built spreadsheet). */
export async function readTemplateMeta(buffer: Buffer, filename: string): Promise<DetectedTemplateMeta> {
  const empty: DetectedTemplateMeta = { module: null, templateVersion: null, templateName: null };
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return empty;

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('_META');
    if (!sheet) return empty;

    const values = new Map<string, string>();
    sheet.eachRow((row) => {
      const key = String(row.getCell(1).value ?? '').trim();
      const value = String(row.getCell(2).value ?? '').trim();
      if (key) values.set(key, value);
    });
    return {
      module: values.get('Module') ?? null,
      templateVersion: values.get('Template Version') ?? null,
      templateName: values.get('Template Name') ?? null,
    };
  } catch {
    return empty;
  }
}

export interface HeaderValidationResult {
  detected: DetectedTemplateMeta;
  /** `null` when the file has no `_META` sheet to compare against (not an
   *  error) - `false` only when `_META` exists and names a different
   *  module, which the caller should surface as a real warning. */
  moduleMatches: boolean | null;
  missingRequiredColumns: string[];
  isValid: boolean;
}

export function validateHeader(contract: ImportContract, detected: DetectedTemplateMeta, headerRow: string[]): HeaderValidationResult {
  const mapping = new ColumnMappingService(contract).mapHeaders(headerRow);
  const moduleMatches = detected.module === null ? null : detected.module === contract.module;
  return {
    detected,
    moduleMatches,
    missingRequiredColumns: mapping.missingRequiredColumns,
    isValid: mapping.missingRequiredColumns.length === 0,
  };
}
