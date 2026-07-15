import { describe, it, expect } from 'vitest';
import { formatDateLocalized, formatDateTimeLocalized } from '../thaiDate';

describe('formatDateLocalized', () => {
  it('renders a Thai-locale date as DD + full Thai month + Buddhist year', () => {
    // 2026-07-01T10:00:00Z is 2026-07-01 17:00 in Bangkok (UTC+7) - well
    // within the same calendar day either way, keeping this assertion
    // independent of exactly where the UTC/Bangkok day boundary falls.
    expect(formatDateLocalized('2026-07-01T10:00:00Z', 'th')).toBe('01 กรกฎาคม 2569');
  });

  it('renders an English-locale date as DD + short English month + Gregorian year', () => {
    expect(formatDateLocalized('2026-07-01T10:00:00Z', 'en')).toBe('01 Jul 2026');
  });

  it('crosses a Bangkok-local day boundary correctly even when the UTC date differs', () => {
    // 23:30 UTC on 2026-01-31 is 06:30 the next day in Bangkok (UTC+7).
    expect(formatDateLocalized('2026-01-31T23:30:00Z', 'th')).toBe('01 กุมภาพันธ์ 2569');
    expect(formatDateLocalized('2026-01-31T23:30:00Z', 'en')).toBe('01 Feb 2026');
  });
});

describe('formatDateTimeLocalized', () => {
  it('renders the Production Pilot Timestamp Standard (dd/MMM/yyyy hh:mm:ss a, Asia/Bangkok), regardless of locale', () => {
    // 2026-07-01T10:15:00Z is 2026-07-01 17:15:00 in Bangkok (UTC+7).
    const th = formatDateTimeLocalized('2026-07-01T10:15:00Z', 'th');
    const en = formatDateTimeLocalized('2026-07-01T10:15:00Z', 'en');
    expect(th).toBe('01/Jul/2026 05:15:00 PM');
    expect(en).toBe('01/Jul/2026 05:15:00 PM');
  });

  it('renders a morning (AM) timestamp with seconds and zero-padded hour', () => {
    // 2026-07-15T02:45:18Z is 2026-07-15 09:45:18 in Bangkok (UTC+7).
    expect(formatDateTimeLocalized('2026-07-15T02:45:18Z', 'en')).toBe('15/Jul/2026 09:45:18 AM');
  });
});
