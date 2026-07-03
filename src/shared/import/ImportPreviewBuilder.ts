/**
 * Universal Import Framework — preview/complete summary assembly
 * (Step 3 and Step 5 share this shape, per spec).
 *
 * Purely a counting/shaping step - a module's own business validation
 * (duplicate detection, required-field checks, master-data lookups)
 * produces the per-row `ImportRowResult[]`; this just turns that list plus
 * a `ColumnMappingResult` into the `ImportSummary` the wizard UI renders.
 */
import { ColumnMappingResult, ImportRowResult, ImportSummary } from './types';

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
