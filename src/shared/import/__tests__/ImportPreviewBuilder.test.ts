import { describe, it, expect } from 'vitest';
import { buildImportResult, buildImportSummary } from '../ImportPreviewBuilder';
import { ImportRowResult } from '../types';

const rows: ImportRowResult[] = [
  { row: 2, reference: 'A', outcome: 'valid' },
  { row: 3, reference: 'B', outcome: 'duplicate', reason: 'Already registered' },
  { row: 4, reference: null, outcome: 'skipped', reason: 'Empty row' },
  { row: 5, reference: 'D', outcome: 'failed', reason: 'Missing dealer_id' },
];

const emptyColumnMapping = { mapped: [], ignoredColumns: [], unknownColumns: [], missingRequiredColumns: [] };

describe('buildImportSummary', () => {
  it('counts each outcome correctly', () => {
    const summary = buildImportSummary(rows, emptyColumnMapping);
    expect(summary.totalRecords).toBe(4);
    expect(summary.readyCount).toBe(1);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
  });
});

describe('buildImportResult', () => {
  it('builds the standard DTO with errors extracted from failed rows', () => {
    const result = buildImportResult(rows, { importedRows: 1, processingTimeMs: 1500 });
    expect(result.totalRows).toBe(4);
    expect(result.readyRows).toBe(1);
    expect(result.importedRows).toBe(1);
    expect(result.skippedRows).toBe(1);
    expect(result.duplicateRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.errors).toEqual([{ row: 5, reference: 'D', message: 'Missing dealer_id' }]);
    expect(result.warningCount).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.processingTime).toBe(1500);
  });

  it('defaults processingTime to null when not supplied', () => {
    const result = buildImportResult(rows, { importedRows: 0 });
    expect(result.processingTime).toBeNull();
  });
});
