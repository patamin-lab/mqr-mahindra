import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

/** Same fake Supabase query builder as `AddressRepository.test.ts` -
 *  `.eq()` actually filters the fixture rows by column/value (a no-op
 *  `.eq()` here would silently return every district/subdistrict
 *  regardless of which province/district was queried, hiding exactly the
 *  cross-province mismatch this file's "milestone example" test exists
 *  to catch). `addressValidation.ts` constructs one `AddressRepository`
 *  at module scope (matching `MasterDataService`'s own singleton), so
 *  the mocked data is set up once, before that module is imported -
 *  every test below shares the same fixture. */
function makeClient(byTable: Record<string, unknown[]>) {
  const from = vi.fn((table: string) => {
    const rows = byTable[table] ?? [];
    const builder: any = {};
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => {
      builder._filtered = (builder._filtered ?? rows).filter((r: Record<string, unknown>) => String(r[column]) === String(value));
      return builder;
    };
    builder.order = () => Promise.resolve({ data: builder._filtered ?? rows, error: null });
    return builder;
  });
  return { client: { from } };
}

vi.mock('@/lib/supabase', () => {
  const { client } = makeClient({
    provinces: [
      { province_id: 31, province_name_th: 'บุรีรัมย์' },
      { province_id: 32, province_name_th: 'สุรินทร์' },
    ],
    districts: [{ district_id: 3101, district_name_th: 'อำเภอเมืองบุรีรัมย์', province_id: 31 }],
    subdistricts: [{ subdistrict_id: 310101, subdistrict_name_th: 'ในเมือง', district_id: 3101, postcode: 31000 }],
  });
  return { getSupabase: () => client };
});

const { validateThaiAddress } = await import('../addressValidation');
const { normalizeThaiAddressValue } = await import('../AddressRepository');

describe('validateThaiAddress', () => {
  it('passes when nothing is provided (address is optional)', async () => {
    expect(await validateThaiAddress({ province: null, district: null, subdistrict: null, postalCode: null })).toEqual({ ok: true });
  });

  it('passes a real, fully-consistent hierarchy', async () => {
    const result = await validateThaiAddress({
      province: 'บุรีรัมย์',
      district: 'อำเภอเมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: '31000',
    });
    expect(result).toEqual({ ok: true });
  });

  it('passes when only the short (no-prefix) forms are given', async () => {
    const result = await validateThaiAddress({
      province: 'บุรีรัมย์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects the exact milestone example - a Buriram district claimed under Surin province', async () => {
    const result = await validateThaiAddress({
      province: 'สุรินทร์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: null,
      postalCode: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('does not belong to Province');
  });

  it('rejects an unknown province', async () => {
    const result = await validateThaiAddress({ province: 'ไม่มีจังหวัดนี้', district: null, subdistrict: null, postalCode: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Invalid Province');
  });

  it('rejects District given without Province', async () => {
    const result = await validateThaiAddress({ province: null, district: 'เมืองบุรีรัมย์', subdistrict: null, postalCode: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Province is required');
  });

  it('rejects a Postal Code that does not match the resolved Sub-District', async () => {
    const result = await validateThaiAddress({
      province: 'บุรีรัมย์',
      district: 'เมืองบุรีรัมย์',
      subdistrict: 'ในเมือง',
      postalCode: '99999',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Postal Code');
  });

  it('tolerates leading/trailing spaces and a doubled internal space in the prefix', async () => {
    const result = await validateThaiAddress({
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
