/**
 * Universal Import Framework — preview/complete summary assembly
 * (Step 3 and Step 5 share this shape, per spec).
 *
 * Purely a counting/shaping step - a module's own business validation
 * (duplicate detection, required-field checks, master-data lookups)
 * produces the per-row `ImportRowResult[]`; this just turns that list plus
 * a `ColumnMappingResult` into the `ImportSummary` the wizard UI renders,
 * or into the standard `ImportResult` DTO (see `types.ts`) a module
 * returns from its API.
 */
import { ColumnMappingResult, ImportResult, ImportRowResult, ImportSummary, ImportWarning } from './types';

export function buildImportSummary(rows: ImportRowResult[], columnMapping: ColumnMappingResult): ImportSummary {
  return {
    totalRecords: rows.length,
    readyCount: rows.filter((r) => r.outcome === 'valid').length,
    duplicateCount: rows.filter((r) => r.outcome === 'duplicate').length,
    skippedCount: rows.filter((r) => r.outcome === 'skipped').length,
    failedCount: rows.filter((r) => r.outcome === 'failed').length,
    rows,
    columnMapping,
  };
}

/** Builds the Standard Import Result DTO from the same per-row outcomes
 *  `buildImportSummary()` uses - `importedRows` only makes sense once
 *  `commit()` has actually run (pass 0/omit warnings for a preview-only
 *  call, where nothing has imported yet). `processingTimeMs` is the
 *  caller's own measured wall-clock duration, or `null` if not measured. */
export function buildImportResult(
  rows: ImportRowResult[],
  options: { importedRows: number; warnings?: ImportWarning[]; processingTimeMs?: number | null }
): ImportResult {
  const errors = rows
    .filter((r) => r.outcome === 'failed')
    .map((r) => ({ row: r.row, reference: r.reference, message: r.reason ?? '' }));
  const warnings = options.warnings ?? [];
  return {
    totalRows: rows.length,
    readyRows: rows.filter((r) => r.outcome === 'valid').length,
    importedRows: options.importedRows,
    skippedRows: rows.filter((r) => r.outcome === 'skipped').length,
    duplicateRows: rows.filter((r) => r.outcome === 'duplicate').length,
    failedRows: errors.length,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
    processingTime: options.processingTimeMs ?? null,
  };
}
