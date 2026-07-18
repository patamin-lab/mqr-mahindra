import { describe, it, expect } from 'vitest';
import { applyTerminologyNormalization, protectAcronyms, ENGINEERING_TERMINOLOGY, PROTECTED_ACRONYMS } from './terminologyDictionary';

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

describe('protectAcronyms', () => {
  it('replaces every protected acronym with a placeholder and restores it verbatim afterward', () => {
    for (const acronym of PROTECTED_ACRONYMS) {
      const { text, restore } = protectAcronyms(`ตรวจสอบ ${acronym} ก่อนใช้งาน`);
      expect(text).not.toContain(acronym);
      expect(restore(text)).toBe(`ตรวจสอบ ${acronym} ก่อนใช้งาน`);
    }
  });

  it('protects multiple distinct acronyms in the same text independently', () => {
    const { text, restore } = protectAcronyms('ECU ควบคุม ABS และ 4WD');
    expect(text).not.toContain('ECU');
    expect(text).not.toContain('ABS');
    expect(text).not.toContain('4WD');
    expect(restore(text)).toBe('ECU ควบคุม ABS และ 4WD');
  });

  it('is a no-op (identity) for text with no protected acronym', () => {
    const { text, restore } = protectAcronyms('ไม่มีตัวย่อในข้อความนี้');
    expect(text).toBe('ไม่มีตัวย่อในข้อความนี้');
    expect(restore(text)).toBe('ไม่มีตัวย่อในข้อความนี้');
  });

  it('restore survives a translation provider transforming the surrounding text, as long as the placeholder itself is untouched', () => {
    const { text, restore } = protectAcronyms('ตรวจสอบ PTO ก่อนใช้งาน');
    // Simulates what a real provider does: translates the Thai words,
    // passes the distinctive placeholder token through unchanged.
    const simulatedTranslation = text.replace('ตรวจสอบ', 'Check').replace('ก่อนใช้งาน', 'before use');
    expect(restore(simulatedTranslation)).toBe('Check PTO before use');
  });
});
