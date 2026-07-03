/**
 * NTR Legacy Import — file parser.
 *
 * Thin, NTR-specific adapter over the Universal Import Framework
 * (`src/shared/import/`): the generic `parseImportFile()` reads the
 * uploaded .xlsx/.csv into a header row + raw string cells (structural
 * parsing - never modified per module), `ColumnMappingService` resolves
 * each `NTR_IMPORT_CONTRACT` field to whichever column actually holds it
 * in this particular file (alias/name-based, not positional - a dealer's
 * columns can be reordered or use a recognized synonym), and each field's
 * own `parse` function (or the default trimmed-string-or-null behavior)
 * coerces the raw cell into `NtrImportRow`'s typed shape. No business
 * validation happens here - see `ntrImportService.ts`'s `validateRows()`.
 * Depends only on `NTR_IMPORT_CONTRACT` - every generic piece it calls
 * into (`ColumnMappingService`, `parseImportFile`, `validateHeader`,
 * `readTemplateMeta`) depends only on `ImportContract`.
 */
import { ColumnMappingService, parseImportFile, readTemplateMeta, validateHeader } from '@/shared/import';
import type { HeaderValidationResult } from '@/shared/import';
import { NtrImportRow } from '../types';
import { NTR_IMPORT_CONTRACT } from './ntrImportFields';

const mappingService = new ColumnMappingService(NTR_IMPORT_CONTRACT);
const fieldByKey = new Map(NTR_IMPORT_CONTRACT.fields.map((f) => [f.canonicalKey, f]));

/** Column index per canonical field, computed once per file (not once per
 *  row) - `columnIndexFor()` re-derives its alias set from the contract's
 *  field list on every call, so calling it inside a per-row loop would
 *  redo that work once per field per row for no reason. */
function buildColumnIndex(headerRow: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  for (const field of NTR_IMPORT_CONTRACT.fields) {
    index[field.canonicalKey] = mappingService.columnIndexFor(headerRow, field.canonicalKey);
  }
  return index;
}

function buildRow(columnIndex: Record<string, number>, cells: string[], rowNumber: number): NtrImportRow {
  const get = (canonicalKey: string): string => {
    const idx = columnIndex[canonicalKey];
    return idx === undefined || idx === -1 ? '' : (cells[idx] ?? '').trim();
  };
  const value = (canonicalKey: string): unknown => {
    const field = fieldByKey.get(canonicalKey)!;
    const raw = get(canonicalKey);
    return field.parse ? field.parse(raw) : raw || null;
  };

  return {
    row: rowNumber,
    dealer_id: get('dealer_id'),
    branch_id: value('branch_id') as string | null,
    serial: get('serial'),
    model: value('model') as string | null,
    engine_number: get('engine_number') || null,
    customer_title: value('customer_title') as string | null,
    customer_first_name: value('customer_first_name') as string | null,
    customer_last_name: value('customer_last_name') as string | null,
    customer_name: get('customer_name'),
    customer_phone: get('customer_phone'),
    customer_address: value('customer_address') as string | null,
    customer_subdistrict: value('customer_subdistrict') as string | null,
    customer_district: value('customer_district') as string | null,
    customer_province: value('customer_province') as string | null,
    customer_postal_code: value('customer_postal_code') as string | null,
    customer_type: value('customer_type') as NtrImportRow['customer_type'],
    product_family_id: value('product_family_id') as string | null,
    variant: value('variant') as string | null,
    retail_date: value('retail_date') as string | null,
    delivery_date: get('delivery_date'),
    pdi_date: value('pdi_date') as string | null,
    manufacturing_year: value('manufacturing_year') as number | null,
    salesperson: value('salesperson') as string | null,
    receiving_person: value('receiving_person') as string | null,
    hour_meter: value('hour_meter') as number | null,
  };
}

export async function parseNtrImportFile(buffer: Buffer, filename: string): Promise<NtrImportRow[]> {
  const { headerRow, dataRows } = await parseImportFile(buffer, filename);
  const columnIndex = buildColumnIndex(headerRow);
  return dataRows.map(({ row, cells }) => buildRow(columnIndex, cells, row));
}

/** Step 3's "Mapped Columns"/"Ignored Columns"/"Unknown Columns"/"Missing
 *  Required Columns" display - re-reads just the header row, no row data. */
export async function mapNtrImportHeaders(buffer: Buffer, filename: string) {
  const { headerRow } = await parseImportFile(buffer, filename);
  return mappingService.mapHeaders(headerRow);
}

/** Header Validation (Step 2/3): detects the file's `_META` (if any) and
 *  checks required columns are present, via the shared framework's
 *  `validateHeader()` - the one place this check is implemented, reused
 *  by `preview/route.ts` instead of a second, ad hoc copy of the same
 *  "are all required columns missing" logic. */
export async function validateNtrImportHeader(buffer: Buffer, filename: string): Promise<HeaderValidationResult> {
  const [{ headerRow }, detected] = await Promise.all([parseImportFile(buffer, filename), readTemplateMeta(buffer, filename)]);
  return validateHeader(NTR_IMPORT_CONTRACT, detected, headerRow);
}
