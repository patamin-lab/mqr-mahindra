import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRows = vi.fn();
const mockFamilies = vi.fn();
const mockDealers = vi.fn();

vi.mock('@/lib/tractorSheet', () => ({
  getTractorInRows: () => mockRows(),
}));
vi.mock('@/lib/db', () => ({
  listActiveProductFamilies: () => mockFamilies(),
  listDealers: () => mockDealers(),
}));

interface VehiclesTableConfig {
  existingSerials: string[];
  insertError?: (payload: Record<string, unknown>) => { message: string; code?: string } | null;
  updateError?: (serial: string) => { message: string; code?: string } | null;
}

function mockClient(config: VehiclesTableConfig) {
  const select = vi.fn().mockResolvedValue({
    data: config.existingSerials.map((serial) => ({ serial })),
    error: null,
  });
  const insert = vi.fn((payload: Record<string, unknown>) => {
    const err = config.insertError?.(payload) ?? null;
    return Promise.resolve({ error: err });
  });
  const update = vi.fn((payload: Record<string, unknown>) => ({
    eq: vi.fn((_col: string, serial: string) => {
      const err = config.updateError?.(serial) ?? null;
      return Promise.resolve({ error: err });
    }),
  }));
  const syncRunInsert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === 'vehicles') return { select, update, insert };
    if (table === 'tractor_in_sync_runs') return { insert: syncRunInsert };
    throw new Error(`unexpected table: ${table}`);
  });

  return { client: { from }, from, select, insert, update, syncRunInsert };
}

const state: { client: unknown } = { client: null };
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

const { TractorInSyncService } = await import('../tractorInSyncService');

const family5000 = { id: 'family-5000', code: '5000', name: '5000 Series', description: null, active: true };
const dealerKTV = { id: 'KTV', short_name: 'KTV', full_name: 'คูณทวีแทรคเตอร์' };

function row(overrides: Partial<Record<string, string>>) {
  return {
    no: '1',
    productSerial: '',
    engineSerial: '',
    productCode: '',
    productModel: '',
    whArrivalDate: '',
    pdiStatus: '',
    deliveryDateThai: '',
    dealer: '',
    productFamily: '',
    subModel: '',
    ...overrides,
  };
}

beforeEach(() => {
  mockFamilies.mockResolvedValue([family5000]);
  mockDealers.mockResolvedValue([dealerKTV]);
});

describe('TractorInSyncService.sync', () => {
  it('inserts a brand-new serial (resolving dealer + product family) and updates an existing one', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'NEW1', productModel: '3140', engineSerial: 'ENG1', dealer: 'ktv', productFamily: '5000', subModel: 'A1' }),
      row({ productSerial: 'EXIST1', productFamily: '5000 Series', subModel: 'B1' }),
    ]);
    const mocked = mockClient({ existingSerials: ['EXIST1'] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync({ triggeredBy: 'qa_tester' });

    expect(result.dryRun).toBe(false);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mocked.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        serial: 'NEW1',
        model: '3140',
        engine_number: 'ENG1',
        dealer_id: 'KTV',
        product_family_id: 'family-5000',
        sub_model: 'A1',
        sync_source: 'tractor_in_sheet',
      })
    );
    const updatePayload = mocked.update.mock.calls[0][0];
    expect(updatePayload).toMatchObject({ product_family_id: 'family-5000', sub_model: 'B1', sync_source: 'tractor_in_sheet' });
  });

  it('reports an unmatched Product Family without blocking the rest of the row', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'S3', productFamily: 'Unknown Family', subModel: 'B1' })]);
    const mocked = mockClient({ existingSerials: ['S3'] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.unmatchedProductFamily).toEqual([{ serial: 'S3', productFamilyText: 'Unknown Family' }]);
    expect(result.updated).toBe(1);
    const updatePayload = mocked.update.mock.calls[0][0];
    expect(updatePayload.product_family_id).toBeUndefined();
    expect(updatePayload.sub_model).toBe('B1');
  });

  it('never creates a duplicate serial: a race unique-violation on insert counts as skipped, not failed', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'RACE1', productFamily: '5000' })]);
    const mocked = mockClient({
      existingSerials: [],
      insertError: () => ({ message: 'duplicate key value violates unique constraint "vehicles_serial_key"', code: '23505' }),
    });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.inserted).toBe(0);
  });

  it('collects a per-row failure and continues processing the remaining rows', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'BAD1', productFamily: '5000' }),
      row({ productSerial: 'GOOD1', productFamily: '5000' }),
    ]);
    const mocked = mockClient({
      existingSerials: ['BAD1', 'GOOD1'],
      updateError: (serial) => (serial === 'BAD1' ? { message: 'connection reset' } : null),
    });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([{ serial: 'BAD1', error: 'connection reset' }]);
    expect(result.updated).toBe(1); // GOOD1 still processed despite BAD1's failure
    expect(result.totalRows).toBe(2);
  });

  it('stamps last_synced_at/sync_source on every synced row even with nothing else to sync', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'S1' })]);
    const mocked = mockClient({ existingSerials: ['S1'] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.updated).toBe(1);
    const updatePayload = mocked.update.mock.calls[0][0];
    expect(updatePayload.sync_source).toBe('tractor_in_sheet');
    expect(typeof updatePayload.last_synced_at).toBe('string');
    expect(updatePayload.product_family_id).toBeUndefined();
    expect(updatePayload.sub_model).toBeUndefined();
  });

  it('persists a sync run summary log with the correct status and counts', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'OK1', productFamily: '5000' }),
      row({ productSerial: 'BAD1', productFamily: '5000' }),
    ]);
    const mocked = mockClient({
      existingSerials: ['OK1', 'BAD1'],
      updateError: (serial) => (serial === 'BAD1' ? { message: 'boom' } : null),
    });
    state.client = mocked.client;

    await new TractorInSyncService().sync({ triggeredBy: 'qa_tester' });

    expect(mocked.syncRunInsert).toHaveBeenCalledTimes(1);
    const logged = mocked.syncRunInsert.mock.calls[0][0];
    expect(logged).toMatchObject({
      total_rows: 2,
      updated: 1,
      failed: 1,
      status: 'partial_failure',
      triggered_by: 'qa_tester',
    });
    expect(typeof logged.duration_ms).toBe('number');
  });

  it('reports success status when every row succeeds', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'OK1', productFamily: '5000' })]);
    const mocked = mockClient({ existingSerials: ['OK1'] });
    state.client = mocked.client;

    await new TractorInSyncService().sync();

    const logged = mocked.syncRunInsert.mock.calls[0][0];
    expect(logged.status).toBe('success');
  });

  it('dry run: reports insert/update/skip counts without writing to vehicles or the run log', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'NEW1', productFamily: '5000' }),
      row({ productSerial: 'EXIST1', productFamily: '5000' }),
      row({ productSerial: '' }), // no serial - always skipped, dry run or not
    ]);
    const mocked = mockClient({ existingSerials: ['EXIST1'] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync({ dryRun: true, triggeredBy: 'qa_tester' });

    expect(result.dryRun).toBe(true);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.totalRows).toBe(3);
    expect(mocked.insert).not.toHaveBeenCalled();
    expect(mocked.update).not.toHaveBeenCalled();
    expect(mocked.syncRunInsert).not.toHaveBeenCalled();
  });

  it('dry run: a duplicate serial within the sheet itself is planned as one insert, not two', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'DUPE1', productFamily: '5000' }),
      row({ productSerial: 'DUPE1', productFamily: '5000' }),
    ]);
    const mocked = mockClient({ existingSerials: [] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync({ dryRun: true });

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1); // second DUPE1 row is now "known" from the first, planned as an update
    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('dry run: still reports unmatched Product Family rows for review', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'S1', productFamily: 'Unknown Family' })]);
    const mocked = mockClient({ existingSerials: [] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync({ dryRun: true });

    expect(result.unmatchedProductFamily).toEqual([{ serial: 'S1', productFamilyText: 'Unknown Family' }]);
    expect(mocked.insert).not.toHaveBeenCalled();
  });

  it('syncs product_code/wh_arrival_date/delivery_date/dealer_id on UPDATE too, not just insert (sheet is the sole vehicle master)', async () => {
    mockRows.mockResolvedValue([
      row({
        productSerial: 'EXIST1',
        productCode: 'PC-100',
        whArrivalDate: '01/06/2026',
        deliveryDateThai: '15/07/2569', // Buddhist era -> 2026-07-15
        dealer: 'ktv',
      }),
    ]);
    const mocked = mockClient({ existingSerials: ['EXIST1'] });
    state.client = mocked.client;

    await new TractorInSyncService().sync();

    const updatePayload = mocked.update.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      product_code: 'PC-100',
      wh_arrival_date: '2026-06-01',
      delivery_date: '2026-07-15',
      dealer_id: 'KTV',
    });
  });

  it('never writes PDI Status anywhere - it has no vehicles column', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'NEW1', pdiStatus: 'Passed' })]);
    const mocked = mockClient({ existingSerials: [] });
    state.client = mocked.client;

    await new TractorInSyncService().sync();

    const insertPayload = mocked.insert.mock.calls[0][0];
    expect(insertPayload.pdi_status).toBeUndefined();
    expect(insertPayload.pdiStatus).toBeUndefined();
  });

  it('reports missing Product Code / WH Arrival Date as a data-quality count, never as a failure - root cause is a blank sheet cell', async () => {
    mockRows.mockResolvedValue([
      row({ productSerial: 'S1', productCode: '', whArrivalDate: '' }),
      row({ productSerial: 'S2', productCode: 'PC-1', whArrivalDate: '01/06/2026' }),
    ]);
    const mocked = mockClient({ existingSerials: ['S1', 'S2'] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync();

    expect(result.missingProductCode).toBe(1);
    expect(result.missingWhArrivalDate).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.updated).toBe(2);
  });

  it('dry run also reports missing Product Code / WH Arrival Date counts (data quality is about the sheet, not the write)', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'S1', productCode: '', whArrivalDate: '' })]);
    const mocked = mockClient({ existingSerials: [] });
    state.client = mocked.client;

    const result = await new TractorInSyncService().sync({ dryRun: true });

    expect(result.missingProductCode).toBe(1);
    expect(result.missingWhArrivalDate).toBe(1);
  });

  it('persists missing-field counts on the sync run log', async () => {
    mockRows.mockResolvedValue([row({ productSerial: 'S1', productCode: '', whArrivalDate: '', productFamily: '5000' })]);
    const mocked = mockClient({ existingSerials: ['S1'] });
    state.client = mocked.client;

    await new TractorInSyncService().sync({ triggeredBy: 'qa_tester' });

    const logged = mocked.syncRunInsert.mock.calls[0][0];
    expect(logged.missing_product_code).toBe(1);
    expect(logged.missing_wh_arrival_date).toBe(1);
  });
});
