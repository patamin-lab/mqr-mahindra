import { describe, it, expect } from 'vitest';
import { computeAverageValidationTimeMs, computeImportPerformanceMetrics, computeRowsPerSecond } from '../ImportMetrics';

describe('computeRowsPerSecond', () => {
  it('computes rows/sec from a row count and duration', () => {
    expect(computeRowsPerSecond(100, 2000)).toBe(50);
  });

  it('returns null when duration is null, zero, or negative', () => {
    expect(computeRowsPerSecond(100, null)).toBeNull();
    expect(computeRowsPerSecond(100, 0)).toBeNull();
    expect(computeRowsPerSecond(100, -5)).toBeNull();
  });

  it('returns null when there are no rows', () => {
    expect(computeRowsPerSecond(0, 1000)).toBeNull();
  });
});

describe('computeAverageValidationTimeMs', () => {
  it('divides total validation time by row count', () => {
    expect(computeAverageValidationTimeMs(500, 100)).toBe(5);
  });

  it('returns null when total time is null or there are no rows', () => {
    expect(computeAverageValidationTimeMs(null, 100)).toBeNull();
    expect(computeAverageValidationTimeMs(500, 0)).toBeNull();
  });
});

describe('computeImportPerformanceMetrics', () => {
  it('combines processing time, rows/sec, and average validation time', () => {
    const result = computeImportPerformanceMetrics({ rowCount: 100, durationMs: 2000, validationTimeMs: 500 });
    expect(result).toEqual({ processingTimeMs: 2000, rowsPerSecond: 50, averageValidationTimeMs: 5 });
  });

  it('omits average validation time when not supplied', () => {
    const result = computeImportPerformanceMetrics({ rowCount: 100, durationMs: 2000 });
    expect(result.averageValidationTimeMs).toBeNull();
  });
});
