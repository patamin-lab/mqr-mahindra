/**
 * Universal Import Framework — performance metrics (informational only).
 *
 * Pure arithmetic over durations/row counts a caller has already measured
 * - nothing here measures time itself (no `Date.now()`/timers), and
 * nothing here affects import behavior, validation, or persistence. Feeds
 * `ImportHistoryEntry`'s `rowsPerSecond`/`averageValidationTimeMs` fields,
 * which the Import History view may display but the framework never
 * branches on.
 */

export function computeRowsPerSecond(rowCount: number, durationMs: number | null): number | null {
  if (durationMs === null || durationMs <= 0 || rowCount <= 0) return null;
  return Math.round((rowCount / durationMs) * 1000 * 100) / 100;
}

export function computeAverageValidationTimeMs(totalValidationTimeMs: number | null, rowCount: number): number | null {
  if (totalValidationTimeMs === null || rowCount <= 0) return null;
  return Math.round((totalValidationTimeMs / rowCount) * 100) / 100;
}

export interface ImportPerformanceMetrics {
  processingTimeMs: number | null;
  rowsPerSecond: number | null;
  averageValidationTimeMs: number | null;
}

/** Convenience wrapper combining both calculations from the two raw
 *  measurements a caller is expected to have taken: overall duration and
 *  (optionally) the time spent purely in per-row validation. */
export function computeImportPerformanceMetrics(input: {
  rowCount: number;
  durationMs: number | null;
  validationTimeMs?: number | null;
}): ImportPerformanceMetrics {
  return {
    processingTimeMs: input.durationMs,
    rowsPerSecond: computeRowsPerSecond(input.rowCount, input.durationMs),
    averageValidationTimeMs: computeAverageValidationTimeMs(input.validationTimeMs ?? null, input.rowCount),
  };
}
