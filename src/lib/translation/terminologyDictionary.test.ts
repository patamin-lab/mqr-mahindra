import { describe, it, expect } from 'vitest';
import { applyTerminologyNormalization, ENGINEERING_TERMINOLOGY } from './terminologyDictionary';

describe('applyTerminologyNormalization', () => {
  it('replaces every provided term with its exact approved English form', () => {
    for (const { th, en } of ENGINEERING_TERMINOLOGY) {
      expect(applyTerminologyNormalization(`ตรวจสอบ${th}พบความเสียหาย`)).toBe(`ตรวจสอบ${en}พบความเสียหาย`);
    }
  });

  it('matches the longest term first (เพลาส่งกำลัง, not เพลา + leftover text)', () => {
    expect(applyTerminologyNormalization('เพลาส่งกำลัง')).toBe('PTO Shaft');
    // "เพลาหน้า"/"เพลาหลัง" both start with "เพลา" too - each must resolve
    // to its own distinct full term, never a partial substring match.
    expect(applyTerminologyNormalization('เพลาหน้า')).toBe('Front Axle');
    expect(applyTerminologyNormalization('เพลาหลัง')).toBe('Rear Axle');
  });

  it('leaves text with no known term completely untouched', () => {
    const text = 'ลูกค้าแจ้งว่ารถสั่นผิดปกติ';
    expect(applyTerminologyNormalization(text)).toBe(text);
  });

  it('replaces multiple distinct terms within the same sentence', () => {
    expect(applyTerminologyNormalization('เปลี่ยนลูกปืนและซีลน้ำมันที่เพลาหน้า')).toBe('เปลี่ยนBearingและOil Sealที่Front Axle');
  });
});
