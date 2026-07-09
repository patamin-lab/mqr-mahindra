import { describe, it, expect, vi } from 'vitest';

const mockRows = vi.fn();
const mockFamilies = vi.fn();

vi.mock('@/lib/tractorSheet', () => ({
  getTractorInRows: () => mockRows(),
}));
vi.mock('@/lib/db', () => ({
  listActiveProductFamilies: () => mockFamilies(),
}));

function mockClient(updateResult: { error: unknown; count: number | null }) {
  const eq = vi.fn().mockResolvedValue(updateResult);
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from }, from, update, eq };
}

const state: { client: unknown } = { client: null };
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

const { TractorInSyncService } = await import('../tractorInSyncService');

const family5000 = { id: 'family-5000', code: '5000', name: '5000 Series', description: null, active: true };

describe('TractorInSyncService.sync', () => {
  it('resolves Product Family by code or name, writes both fields, reports unmatched rows', async () => {
    mockFamilies.mockResolvedValue([family5000]);
    mockRows.mockResolvedValue([
      { productSerial: 'S1', productFamily: '5000', subModel: 'A1', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '1' },
      { productSerial: 'S2', productFamily: '5000 Series', subModel: '', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '2' },
      { productSerial: 'S3', productFamily: 'Unknown Family', subModel: 'B1', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '3' },
      { productSerial: '', productFamily: '5000', subModel: '', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '4' },
      { productSerial: 'S5', productFamily: '', subModel: '', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '5' },
    ]);
    const mocked = mockClient({ error: null, count: 1 });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.totalRows).toBe(5);
    expect(result.skippedNoSerial).toBe(1);
    expect(result.updated).toBe(3); // S1, S2, S3 all write something (S3 writes sub_model even with unmatched family)
    expect(result.unmatchedProductFamily).toEqual([{ serial: 'S3', productFamilyText: 'Unknown Family' }]);
    // S5 has neither a matched family nor a sub model - never written.
    expect(mocked.from).toHaveBeenCalledTimes(3);
  });

  it('never writes vehicles.product_family_id/sub_model for a row with nothing to sync', async () => {
    mockFamilies.mockResolvedValue([family5000]);
    mockRows.mockResolvedValue([
      { productSerial: 'S1', productFamily: '', subModel: '', engineSerial: '', productCode: '', productModel: '', whArrivalDate: '', pdiStatus: '', no: '1' },
    ]);
    const mocked = mockClient({ error: null, count: 0 });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.updated).toBe(0);
    expect(mocked.from).not.toHaveBeenCalled();
  });
});
