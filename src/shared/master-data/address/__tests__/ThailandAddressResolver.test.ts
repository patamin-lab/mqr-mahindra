import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Same fake Supabase query builder shape as `AddressRepository.test.ts` -
 *  every query here also ends in `.order(...)`. */
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

const state: { client: { from: ReturnType<typeof vi.fn> } | null } = { client: null };
vi.mock('@/lib/supabase', () => ({ getSupabase: () => state.client }));

const { resolveThaiAddress } = await import('../ThailandAddressResolver');

const PROVINCES = [
  { province_id: 10, province_name_th: 'กรุงเทพมหานคร' },
  { province_id: 80, province_name_th: 'นครศรีธรรมราช' },
  { province_id: 81, province_name_th: 'นครปฐม' },
  { province_id: 31, province_name_th: 'บุรีรัมย์' },
];
const DISTRICTS = [
  { district_id: 3101, district_name_th: 'อำเภอเมืองบุรีรัมย์', province_id: 31 },
  { district_id: 8001, district_name_th: 'อำเภอเมืองนครศรีธรรมราช', province_id: 80 },
];
const SUBDISTRICTS = [
  { subdistrict_id: 310101, subdistrict_name_th: 'ในเมือง', district_id: 3101, postcode: 31000 },
  // A second, unrelated "ในเมือง" subdistrict in a different district - real
  // Thailand has many repeated subdistrict names nationally.
  { subdistrict_id: 8000101, subdistrict_name_th: 'ในเมือง', district_id: 8001, postcode: 80000 },
];

beforeEach(() => {
  state.client = makeClient({
    provinces: { data: PROVINCES, error: null },
    districts: { data: DISTRICTS, error: null },
    subdistricts: { data: SUBDISTRICTS, error: null },
  }).client;
});

describe('resolveThaiAddress', () => {
  it('resolves fully blank input as ok with no IDs (matches validateThaiAddress contract)', async () => {
    const result = await resolveThaiAddress({});
    expect(result).toMatchObject({ ok: true, provinceId: null, districtId: null, subdistrictId: null, resolutionMethod: 'exact' });
  });

  it('resolves bottom-up from Subdistrict alone when the name is nationally unique enough to disambiguate via given District', async () => {
    const result = await resolveThaiAddress({ subdistrict: 'ในเมือง', district: 'เมืองบุรีรัมย์' });
    expect(result.ok).toBe(true);
    expect(result.provinceId).toBe('31');
    expect(result.districtId).toBe('3101');
    expect(result.subdistrictId).toBe('310101');
  });

  it('reports Address Ambiguous when Subdistrict alone matches multiple locations with no hint to narrow it', async () => {
    const result = await resolveThaiAddress({ subdistrict: 'ในเมือง' });
    expect(result.ok).toBe(false);
    expect(result.resolutionMethod).toBe('ambiguous');
    expect(result.reason).toContain('Address Ambiguous');
  });

  it('resolves Province via the Bangkok alias table ("กทม." -> กรุงเทพมหานคร)', async () => {
    const result = await resolveThaiAddress({ province: 'กทม.' });
    expect(result.ok).toBe(true);
    expect(result.provinceId).toBe('10');
    expect(result.resolutionMethod).toBe('alias');
    expect(result.normalized.province).toBe('กรุงเทพมหานคร');
  });

  it('resolves Province via the English "Bangkok" alias', async () => {
    const result = await resolveThaiAddress({ province: 'Bangkok' });
    expect(result.ok).toBe(true);
    expect(result.provinceId).toBe('10');
  });

  it('resolves a ฯ-truncated province name when the prefix is unique ("นครศรีฯ" -> นครศรีธรรมราช, not นครปฐม)', async () => {
    const result = await resolveThaiAddress({ province: 'นครศรีฯ' });
    expect(result.ok).toBe(true);
    expect(result.provinceId).toBe('80');
    expect(result.resolutionMethod).toBe('alias');
  });

  it('reports Address Not Found for a province that matches nothing', async () => {
    const result = await resolveThaiAddress({ province: 'ไม่มีจังหวัดนี้' });
    expect(result.ok).toBe(false);
    expect(result.resolutionMethod).toBe('not_found');
    expect(result.reason).toContain('Address Not Found');
  });

  it('never throws for an unresolvable address - it always returns a result the caller can continue the batch with', async () => {
    await expect(resolveThaiAddress({ province: 'xyz', district: 'xyz', subdistrict: 'xyz' })).resolves.toBeDefined();
  });
});
