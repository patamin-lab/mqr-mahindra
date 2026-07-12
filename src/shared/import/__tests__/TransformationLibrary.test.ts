import { describe, it, expect } from 'vitest';
import { trim, toUpperCase, toLowerCase, toStringOrNull, toNumberOrNull, toBooleanOrNull, normalizeWhitespace, normalizeDate } from '../TransformationLibrary';

describe('TransformationLibrary', () => {
  it('trim/toUpperCase/toLowerCase', () => {
    expect(trim('  hi  ')).toBe('hi');
    expect(toUpperCase('  hi  ')).toBe('HI');
    expect(toLowerCase('  HI  ')).toBe('hi');
  });

  it('toStringOrNull treats blank as null, keeps trimmed text otherwise', () => {
    expect(toStringOrNull('   ')).toBeNull();
    expect(toStringOrNull(' abc ')).toBe('abc');
  });

  it('toNumberOrNull parses numbers, including thousands separators, and rejects non-numeric text', () => {
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull('42')).toBe(42);
    expect(toNumberOrNull('1,234')).toBe(1234);
    expect(toNumberOrNull('not a number')).toBeNull();
  });

  it('toBooleanOrNull recognizes English and Thai yes/no spellings, null for anything else', () => {
    expect(toBooleanOrNull('Yes')).toBe(true);
    expect(toBooleanOrNull('1')).toBe(true);
    expect(toBooleanOrNull('ใช่')).toBe(true);
    expect(toBooleanOrNull('No')).toBe(false);
    expect(toBooleanOrNull('0')).toBe(false);
    expect(toBooleanOrNull('ไม่ใช่')).toBe(false);
    expect(toBooleanOrNull('maybe')).toBeNull();
    expect(toBooleanOrNull('')).toBeNull();
  });

  it('normalizeWhitespace collapses internal runs and trims', () => {
    expect(normalizeWhitespace('  a   b\t c  ')).toBe('a b c');
  });

  describe('normalizeDate', () => {
    it('accepts already-ISO dates unchanged', () => {
      expect(normalizeDate('2025-10-31')).toBe('2025-10-31');
    });

    it('parses "31 Oct 2025" / "31 October 2025"', () => {
      expect(normalizeDate('31 Oct 2025')).toBe('2025-10-31');
      expect(normalizeDate('31 October 2025')).toBe('2025-10-31');
    });

    it('parses slash and dash D/M/Y dates', () => {
      expect(normalizeDate('31/10/2025')).toBe('2025-10-31');
      expect(normalizeDate('31-10-2025')).toBe('2025-10-31');
    });

    it('returns null for an unparseable date rather than storing garbage', () => {
      expect(normalizeDate('not a date')).toBeNull();
      expect(normalizeDate('')).toBeNull();
    });
  });
});
