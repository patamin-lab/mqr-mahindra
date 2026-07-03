import { describe, it, expect } from 'vitest';
import { parseImportDate } from '../services/ntrImportFields';

describe('parseImportDate', () => {
  it('passes through an already-ISO date unchanged', () => {
    expect(parseImportDate('2025-10-31')).toBe('2025-10-31');
  });

  it('parses "D MMM YYYY" (abbreviated month name)', () => {
    expect(parseImportDate('31 Oct 2025')).toBe('2025-10-31');
  });

  it('parses "D MMMM YYYY" (full month name)', () => {
    expect(parseImportDate('5 January 2026')).toBe('2026-01-05');
  });

  it('parses "DD/MM/YYYY"', () => {
    expect(parseImportDate('31/10/2025')).toBe('2025-10-31');
  });

  it('parses "DD-MM-YYYY"', () => {
    expect(parseImportDate('31-10-2025')).toBe('2025-10-31');
  });

  it('pads single-digit days and months', () => {
    expect(parseImportDate('5/1/2026')).toBe('2026-01-05');
    expect(parseImportDate('5 Jan 2026')).toBe('2026-01-05');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(parseImportDate('')).toBeNull();
    expect(parseImportDate('   ')).toBeNull();
    expect(parseImportDate('not a date')).toBeNull();
  });

  it('returns null for an unrecognized month name', () => {
    expect(parseImportDate('31 Foo 2025')).toBeNull();
  });

  it('returns null for an out-of-range day or month', () => {
    expect(parseImportDate('32 Oct 2025')).toBeNull();
    expect(parseImportDate('15/13/2025')).toBeNull();
  });
});
