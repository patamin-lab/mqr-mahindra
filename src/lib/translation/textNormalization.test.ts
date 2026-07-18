import { describe, it, expect } from 'vitest';
import { normalizeUnits, normalizeWhitespaceAndLists } from './textNormalization';

describe('normalizeUnits', () => {
  it('converts the exact given examples', () => {
    expect(normalizeUnits('ใช้งานมาแล้ว 20 ชั่วโมง')).toBe('ใช้งานมาแล้ว 20 hours');
    expect(normalizeUnits('ระยะห่าง 5 มม.')).toBe('ระยะห่าง 5 mm');
  });

  it('only substitutes a unit word directly following a number, not as ordinary prose', () => {
    // "วัน" (day) appears both as a unit after a number and as an
    // unrelated word elsewhere in the same sentence - only the
    // number-anchored occurrence must convert.
    expect(normalizeUnits('รอ 3 วัน แล้วจะโทรกลับวันหลัง')).toBe('รอ 3 days แล้วจะโทรกลับวันหลัง');
  });

  it('leaves text with no unit-after-number pattern untouched', () => {
    const text = 'ไม่มีตัวเลขหน่วยในข้อความนี้';
    expect(normalizeUnits(text)).toBe(text);
  });
});

describe('normalizeWhitespaceAndLists', () => {
  it('collapses runs of blank lines to a single blank line', () => {
    expect(normalizeWhitespaceAndLists('line1\n\n\n\nline2')).toBe('line1\n\nline2');
  });

  it('trims trailing/leading whitespace per line', () => {
    expect(normalizeWhitespaceAndLists('  hello   \n  world  ')).toBe('hello\nworld');
  });

  it('normalizes bullet glyphs to a single "- " prefix', () => {
    expect(normalizeWhitespaceAndLists('• first\n* second\n- third')).toBe('- first\n- second\n- third');
  });

  it('trims the overall result', () => {
    expect(normalizeWhitespaceAndLists('\n\n  text  \n\n')).toBe('text');
  });
});
