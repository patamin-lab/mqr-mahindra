import { describe, it, expect } from 'vitest';
import { validateNtrAddress } from '../services/ntrAddressValidation';
import { normalizeThaiAddressValue } from '../services/thaiAddressMasterData';

describe('validateNtrAddress', () => {
  it('passes when nothing is provided (address is optional)', () => {
    expect(validateNtrAddress({ province: null, district: null, subdistrict: null, postalCode: null })).toEqual({ ok: true });
  });

  it('passes a real, fully-consistent hierarchy', () => {
    const result = validateNtrAddress({
      province: 'บุรีรัมย์',
      district: 'อำเภอเมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: '31000',
    });
    expect(result).toEqual({ ok: true });
  });

  it('passes when only the short (no-prefix) forms are given', () => {
    const result = validateNtrAddress({
      province: 'บุรีรัมย์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects the exact milestone example - a Buriram district claimed under Surin province', () => {
    const result = validateNtrAddress({
      province: 'สุรินทร์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: null,
      postalCode: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('does not belong to Province');
  });

  it('rejects an unknown province', () => {
    const result = validateNtrAddress({ province: 'ไม่มีจังหวัดนี้', district: null, subdistrict: null, postalCode: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Invalid Province');
  });

  it('rejects District given without Province', () => {
    const result = validateNtrAddress({ province: null, district: 'เมืองบุรีรัมย์', subdistrict: null, postalCode: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Province is required');
  });

  it('rejects a Postal Code that does not match the resolved Sub-District', () => {
    const result = validateNtrAddress({
      province: 'บุรีรัมย์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: '99999',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Postal Code');
  });

  it('tolerates leading/trailing spaces and a doubled internal space in the prefix', () => {
    const result = validateNtrAddress({
      province: '  บุรีรัมย์  ',
      district: 'อำเภอ  เมืองบุรีรัมย์',
      subdistrict: '  ในเมือง  ',
      postalCode: '31000',
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('normalizeThaiAddressValue', () => {
  it('strips a known administrative-unit prefix', () => {
    expect(normalizeThaiAddressValue('อำเภอเมืองบุรีรัมย์')).toBe('เมืองบุรีรัมย์');
  });

  it('collapses multiple internal spaces and trims', () => {
    expect(normalizeThaiAddressValue('  บุรีรัมย์   ')).toBe('บุรีรัมย์');
  });

  it('leaves a value with no known prefix unchanged (aside from whitespace)', () => {
    expect(normalizeThaiAddressValue('เมืองบุรีรัมย์')).toBe('เมืองบุรีรัมย์');
  });
});
