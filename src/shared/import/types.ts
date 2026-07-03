/**
 * Universal Import Framework — shared types.
 *
 * Generic across every module that imports historical/bulk data via the
 * Import Wizard (NTR today; Vehicle Master/PM/PDI/MQR/Campaign/Parts are
 * future consumers per docs/engineering/IMPORT_FRAMEWORK.md). Nothing in
 * this file knows about any one module's business fields - a module
 * supplies its own `ImportFieldDefinition[]` and everything downstream
 * (mapping, template generation, parsing, preview, error formatting) is
 * driven by that definition list.
 */

/** One business field a module's import template captures. `canonicalKey`
 *  is the internal field name (e.g. `dealer_id`) the module's own row type
 *  uses; `aliases` are every header spelling the mapper should recognize
 *  (including `canonicalKey` and `displayLabel` themselves - callers don't
 *  need to repeat them). `parse` converts the raw trimmed cell string into
 *  whatever typed value the module's row type expects; omitted means "keep
 *  as trimmed string or null when empty". */
export interface ImportFieldDefinition {
  canonicalKey: string;
  displayLabel: string;
  required: boolean;
  aliases: string[];
  parse?: (raw: string) => unknown;
}

/** A single import template's identity, embedded in the generated
 *  workbook's `_META` sheet and checked against on upload (Header
 *  Validation: Template Version + Module Type). Bumping `version` is how a
 *  module signals its template shape changed - old files with an older
 *  version still parse (column matching is alias/name-based, not
 *  positional), this is purely informational/diagnostic, never a hard
 *  reject on its own. */
export interface ImportTemplateMeta {
  module: string;
  templateName: string;
  templateVersion: string;
}

/** Result of matching an uploaded file's header row against a module's
 *  field definitions - the "Mapped Columns" / "Ignored Columns" / "Unknown
 *  Columns" / "Missing Required Columns" display in Step 3. */
export interface ColumnMappingResult {
  /** Header text (as found in the file) -> canonical field key. */
  mapped: { header: string; canonicalKey: string; displayLabel: string }[];
  /** Recognized-but-optional-and-absent columns - never blocks import. */
  ignoredColumns: string[];
  /** Header text present in the file that matched no known alias. */
  unknownColumns: string[];
  /** Required fields with no matching header at all - blocks import. */
  missingRequiredColumns: string[];
}

/** One row's field values after column mapping, keyed by canonicalKey,
 *  before any module-specific business validation runs. */
export type MappedImportRow = {
  row: number;
  values: Record<string, unknown>;
};

/** Generic per-row classification - every module's business validation
 *  produces this same shape so Step 3/Step 5's summary counts are uniform
 *  across modules. */
export type ImportRowOutcome = 'valid' | 'duplicate' | 'skipped' | 'failed';

export interface ImportRowResult {
  row: number;
  reference: string | null;
  outcome: ImportRowOutcome;
  reason?: string;
}

/** Step 3 (Preview & Validation) / Step 5 (Import Complete) summary -
 *  identical shape for both, since Step 5 is really "Step 3's counts,
 *  after commit instead of before it". */
export interface ImportSummary {
  totalRecords: number;
  readyCount: number;
  duplicateCount: number;
  skippedCount: number;
  failedCount: number;
  rows: ImportRowResult[];
  columnMapping: ColumnMappingResult;
}

/** Import History's module-agnostic row shape - a concrete module's
 *  history service maps its own session type into this. */
export interface ImportHistoryEntry {
  id: string;
  module: string;
  filename: string;
  importedBy: string;
  startedAt: string;
  completedAt: string | null;
  totalRecords: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  archiveStatus: string;
  durationMs: number | null;
}
