import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Minimal fake Supabase query builder - every `AddressRepository` query
 *  ends in `.order(...)`, so that's where the mocked result resolves;
 *  `.select()`/`.eq()` just return the same builder for chaining, same
 *  shape as `supabaseNtrRepository.test.ts`'s fake client. */
function makeClient(byTable: Record<string, { data: unknown; error: unknown }>) {
  const from = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: [], error: null };
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => Promise.resolve(result));
    return builder;
  });
  return { client: { from }, from };
}

const state: { client: { from: ReturnType<typeof vi.fn> } | null } = { client: null };

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

const { AddressRepository } = await import('../AddressRepository');

const PROVINCES = [
  { province_id: 31, province_name_th: 'บุรีรัมย์' },
  { province_id: 32, province_name_th: 'สุรินทร์' },
];
const DISTRICTS_31 = [
  { district_id: 3101, district_name_th: 'อำเภอเมืองบุรีรัมย์', province_id: 31 },
];
const SUBDISTRICTS_3101 = [
  { subdistrict_id: 310101, subdistrict_name_th: 'ในเมือง', district_id: 3101, postcode: 31000 },
];

beforeEach(() => {
  const { client } = makeClient({
    provinces: { data: PROVINCES, error: null },
    districts: { data: DISTRICTS_31, error: null },
    subdistricts: { data: SUBDISTRICTS_3101, error: null },
  });
  state.client = client;
});

describe('AddressRepository - listing views (AddressSelector support)', () => {
  it('lists provinces from the canonical Supabase table', async () => {
    const repo = new AddressRepository();
    const provinces = await repo.listProvinces();
    expect(provinces).toEqual([
      { provinceId: '31', provinceThai: 'บุรีรัมย์' },
      { provinceId: '32', provinceThai: 'สุรินทร์' },
    ]);
  });

  it('caches provinces on the instance - a second call does not re-query', async () => {
    const repo = new AddressRepository();
    await repo.listProvinces();
    const { from } = makeClient({});
    state.client = { from };
    const second = await repo.listProvinces();
    expect(from).not.toHaveBeenCalled();
    expect(second.length).toBe(2);
  });

  it('lists districts scoped to their province', async () => {
    const repo = new AddressRepository();
    const districts = await repo.listDistricts('31');
    expect(districts).toEqual([{ districtId: '3101', districtThai: 'อำเภอเมืองบุรีรัมย์', provinceId: '31' }]);
  });

  it('lists subdistricts scoped to their district, with a single postcode', async () => {
    const repo = new AddressRepository();
    const subdistricts = await repo.listSubdistricts('3101');
    expect(subdistricts).toEqual([{ tambonId: '310101', tambonThai: 'ในเมือง', districtId: '3101', postalCodes: ['31000'] }]);
  });

  it('throws when Supabase returns an error', async () => {
    const { client } = makeClient({ provinces: { data: null, error: new Error('connection reset') } });
    state.client = client;
    const repo = new AddressRepository();
    await expect(repo.listProvinces()).rejects.toThrow('connection reset');
  });
});

describe('AddressRepository - find by name (normalized)', () => {
  it('finds a province by its Thai name', async () => {
    const repo = new AddressRepository();
    const found = await repo.findProvince('บุรีรัมย์');
    expect(found?.provinceId).toBe('31');
  });

  it('finds a district by its short (no-prefix) name', async () => {
    const repo = new AddressRepository();
    const found = await repo.findDistrict('เมืองบุรีรัมย์', '31');
    expect(found?.districtId).toBe('3101');
  });

  it('finds a subdistrict and returns its postal code', async () => {
    const repo = new AddressRepository();
    const found = await repo.findSubdistrict('ในเมือง', '3101');
    expect(found?.postalCodes).toEqual(['31000']);
  });

  it('returns null for an unknown name', async () => {
    const repo = new AddressRepository();
    expect(await repo.findProvince('ไม่มีจังหวัดนี้')).toBeNull();
  });
});
