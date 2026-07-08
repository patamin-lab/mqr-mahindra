import { describe, it, expect, vi } from 'vitest';

/** MasterDataService's Address Platform methods are Supabase-backed
 *  (ADR-011 v2) - same fake query builder as `AddressRepository.test.ts`. */
function makeClient(byTable: Record<string, { data: unknown; error: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: [], error: null };
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => Promise.resolve(result));
    return builder;
  });
  return { client: { from } };
}

vi.mock('@/lib/supabase', () => {
  const { client } = makeClient({
    provinces: { data: [{ province_id: 31, province_name_th: 'บุรีรัมย์' }], error: null },
    districts: { data: [], error: null },
    subdistricts: { data: [], error: null },
  });
  return { getSupabase: () => client };
});

const { MasterDataService } = await import('../MasterDataService');

describe('MasterDataService - public facade', () => {
  it('exposes the Address Platform (Supabase-backed, async)', async () => {
    expect(await MasterDataService.findProvince('บุรีรัมย์')).not.toBeNull();
    expect(await MasterDataService.validateThaiAddress({ province: null, district: null, subdistrict: null, postalCode: null })).toEqual({ ok: true });
  });

  it('exposes the Lookup Platform', () => {
    expect(MasterDataService.customerTypeValues).toEqual(['Individual', 'Company']);
    expect(MasterDataService.customerTypeLabel('Individual', 'en')).toBe('Individual');
    expect(MasterDataService.normalizeCustomerType('company')).toBe('Company');
  });

  it('exposes the Configuration Platform', () => {
    expect(MasterDataService.getWarrantyLimitMonths('powertrain')).toBe(48);
    expect(MasterDataService.getWarrantyLimitMonths('other')).toBe(24);
  });

  it('exposes the Reference Data Platform as callable functions', () => {
    expect(typeof MasterDataService.getDealers).toBe('function');
    expect(typeof MasterDataService.getDealerById).toBe('function');
    expect(typeof MasterDataService.getBranchesForDealer).toBe('function');
    expect(typeof MasterDataService.getBranch).toBe('function');
    expect(typeof MasterDataService.getTechniciansForDealer).toBe('function');
    expect(typeof MasterDataService.getActiveProductFamilies).toBe('function');
    expect(typeof MasterDataService.getProductFamilyById).toBe('function');
  });
});
