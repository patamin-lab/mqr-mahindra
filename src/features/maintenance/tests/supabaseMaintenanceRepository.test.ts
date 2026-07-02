import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number;
}

/**
 * Fake Supabase query builder. Chain methods (select/eq/order/insert/update)
 * record their calls and return the same builder, matching the real
 * supabase-js fluent API. `.single()`/`.maybeSingle()` resolve to the
 * configured result, and the builder itself is thenable so `await query`
 * also resolves to it - matching how the repository awaits `list()`/
 * `delete()` without a terminal `.single()` call.
 *
 * Deliberately has no `.delete()` method: if SupabaseMaintenanceRepository
 * ever called a real hard delete instead of a soft-delete `update()`, this
 * mock would throw "not a function" and fail the test loudly.
 */
function createQueryBuilder(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'order', 'insert', 'update', 'range', 'or', 'gte', 'lte', 'lt'] as const;

  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);

  return { builder, calls };
}

/**
 * next_job_seq() is called directly on the client (not part of the
 * chainable query builder), used by create() to generate pm_number.
 * create() also looks up technicians/branches/pm_intervals by id to
 * resolve the technician_name/branch_name snapshot and next_pm_due - each
 * of those needs its own table-scoped builder/result, distinct from the
 * main pm_records query, so `from` dispatches by table name instead of
 * always returning the same shared builder.
 */
function mockGetSupabase(
  result: QueryResult,
  rpcResult: QueryResult = { data: 1, error: null },
  lookups: Record<string, QueryResult> = {}
) {
  const { builder, calls } = createQueryBuilder(result);
  const lookupBuilders: Record<string, ReturnType<typeof createQueryBuilder>> = {};
  const from = vi.fn((table: string) => {
    if (table === 'pm_records') return builder;
    if (!lookupBuilders[table]) {
      lookupBuilders[table] = createQueryBuilder(lookups[table] ?? { data: null, error: null });
    }
    return lookupBuilders[table].builder;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { client: { from, rpc }, builder, calls, rpc, lookupBuilders };
}

const state: { client: { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> } | null } = { client: null };

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

// Imported after the mock is registered so the repository picks it up.
const { SupabaseMaintenanceRepository } = await import('../repositories/supabaseMaintenanceRepository');

function setupClient(result: QueryResult, rpcResult?: QueryResult, lookups?: Record<string, QueryResult>) {
  const mocked = mockGetSupabase(result, rpcResult, lookups);
  state.client = mocked.client as unknown as { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> };
  return mocked;
}

const activeRecord = {
  id: 'rec-1',
  dealer_id: 'D1',
  branch_id: null,
  serial: 'SN-1',
  model: null,
  delivery_date: null,
  engine_number: null,
  customer_name: 'Somchai',
  customer_phone: '081-2345678',
  technician_id: null,
  technician_name: 'ช่างสมชาย',
  branch_name: 'สาขา A',
  scheduled_date: null,
  performed_date: '2026-01-01',
  hour_meter: 100,
  pm_interval_id: 'interval-1',
  pm_number: 'PM-D1-2026-000001',
  next_pm_due: '2026-07-01',
  meter_photo_url: 'https://drive.google.com/meter.jpg',
  nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
  report_photo_url: 'https://drive.google.com/report.jpg',
  latitude: 13.7563,
  longitude: 100.5018,
  gps_accuracy: 5,
  google_maps_url: 'https://maps.google.com/?q=13.7563,100.5018',
  status: 'Scheduled',
  notes: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
  record_status: 'Active',
};

describe('SupabaseMaintenanceRepository', () => {
  beforeEach(() => {
    state.client = null;
  });

  describe('list', () => {
    it('always filters record_status=Active, with no other filters applied by default', async () => {
      const { client, calls } = setupClient({ data: [activeRecord], error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.list();

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([['record_status', 'Active']]);
      expect(result).toEqual([activeRecord]);
    });

    it('applies dealerId, branchId, and status filters when provided', async () => {
      const { calls } = setupClient({ data: [], error: null });
      const repository = new SupabaseMaintenanceRepository();

      await repository.list({ dealerId: 'D1', branchId: 'B1', status: 'Scheduled' });

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['record_status', 'Active'],
        ['dealer_id', 'D1'],
        ['branch_id', 'B1'],
        ['status', 'Scheduled'],
      ]);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down') });
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.list()).rejects.toThrow('db down');
    });
  });

  describe('getById', () => {
    it('returns the record when active', async () => {
      setupClient({ data: activeRecord, error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.getById('rec-1');

      expect(result).toEqual(activeRecord);
    });

    it('returns null when the record is soft-deleted', async () => {
      setupClient({ data: { ...activeRecord, record_status: 'Deleted' }, error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.getById('rec-1');

      expect(result).toBeNull();
    });

    it('returns null when no row is found', async () => {
      setupClient({ data: null, error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.getById('missing');

      expect(result).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down') });
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.getById('rec-1')).rejects.toThrow('db down');
    });
  });

  describe('create', () => {
    const input = {
      dealer_id: 'D1',
      branch_id: 'branch-1',
      serial: 'SN-1',
      model: null,
      delivery_date: null,
      engine_number: null,
      customer_name: 'Somchai',
      customer_phone: '081-2345678',
      technician_id: 'tech-1',
      performed_date: '2026-01-01',
      hour_meter: 100,
      pm_interval_id: 'interval-1',
      meter_photo_url: 'https://drive.google.com/meter.jpg',
      nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
      report_photo_url: 'https://drive.google.com/report.jpg',
      latitude: 13.7563,
      longitude: 100.5018,
      gps_accuracy: 5,
      google_maps_url: 'https://maps.google.com/?q=13.7563,100.5018',
      notes: null,
    };
    const actor = { username: 'alice' };

    const lookups = {
      technicians: { data: { name: 'ช่างสมชาย' }, error: null },
      branches: { data: { name: 'สาขา A' }, error: null },
      pm_intervals: { data: { interval_months: 6 }, error: null },
    };

    it('inserts a payload with a generated id, a generated pm_number, and record_status=Active', async () => {
      const { calls, rpc } = setupClient({ data: activeRecord, error: null }, { data: 1, error: null }, lookups);
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.create(input, actor);

      expect(rpc).toHaveBeenCalledWith('next_job_seq', { p_dealer_id: 'D1', p_year: expect.any(String) });

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(typeof payload.id).toBe('string');
      expect(payload.pm_number).toMatch(/^PM-D1-\d{4}-\d{6}$/);
      expect(payload).toMatchObject({
        dealer_id: 'D1',
        serial: 'SN-1',
        customer_name: 'Somchai',
        hour_meter: 100,
        pm_interval_id: 'interval-1',
        latitude: 13.7563,
        longitude: 100.5018,
        gps_accuracy: 5,
        google_maps_url: 'https://maps.google.com/?q=13.7563,100.5018',
        created_by: 'alice',
        updated_by: 'alice',
        record_status: 'Active',
      });
      expect(result).toEqual(activeRecord);
    });

    it('resolves technician_name/branch_name snapshots and computes next_pm_due from the interval', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null }, { data: 1, error: null }, lookups);
      const repository = new SupabaseMaintenanceRepository();

      await repository.create(input, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(payload.technician_name).toBe('ช่างสมชาย');
      expect(payload.branch_name).toBe('สาขา A');
      // performed_date 2026-01-01 + 6 months = 2026-07-01
      expect(payload.next_pm_due).toBe('2026-07-01');
    });

    it('leaves technician_name/branch_name/next_pm_due null when their ids are absent or the interval is hour-based only', async () => {
      const { calls } = setupClient(
        { data: activeRecord, error: null },
        { data: 1, error: null },
        { pm_intervals: { data: { interval_months: null }, error: null } }
      );
      const repository = new SupabaseMaintenanceRepository();

      await repository.create({ ...input, technician_id: null, branch_id: null }, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(payload.technician_name).toBeNull();
      expect(payload.branch_name).toBeNull();
      expect(payload.next_pm_due).toBeNull();
    });

    it('inserts null GPS fields when the technician did not capture a location', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null }, { data: 1, error: null }, lookups);
      const repository = new SupabaseMaintenanceRepository();

      await repository.create({ ...input, latitude: null, longitude: null, gps_accuracy: null, google_maps_url: null }, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(payload.latitude).toBeNull();
      expect(payload.longitude).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('insert failed') }, undefined, lookups);
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.create(input, actor)).rejects.toThrow('insert failed');
    });
  });

  describe('update', () => {
    const actor = { username: 'alice' };

    it('only includes fields present on the input, plus updated_by/updated_at, and scopes by record_status=Active', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null });
      const repository = new SupabaseMaintenanceRepository();

      await repository.update('rec-1', { status: 'Completed' }, actor);

      const updateCall = calls.find((c) => c.method === 'update');
      const payload = updateCall?.args[0] as Record<string, unknown>;
      expect(payload).toEqual(
        expect.objectContaining({ status: 'Completed', updated_by: 'alice' })
      );
      expect(payload).not.toHaveProperty('branch_id');
      expect(payload).not.toHaveProperty('serial');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['id', 'rec-1'],
        ['record_status', 'Active'],
      ]);
    });

    it('includes GPS fields when present on the input', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null });
      const repository = new SupabaseMaintenanceRepository();

      await repository.update(
        'rec-1',
        { latitude: 13.7563, longitude: 100.5018, gps_accuracy: 5, google_maps_url: 'https://maps.google.com/?q=13.7563,100.5018' },
        actor
      );

      const updateCall = calls.find((c) => c.method === 'update');
      const payload = updateCall?.args[0] as Record<string, unknown>;
      expect(payload).toEqual(
        expect.objectContaining({ latitude: 13.7563, longitude: 100.5018, gps_accuracy: 5 })
      );
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('update failed') });
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.update('rec-1', { status: 'Completed' }, actor)).rejects.toThrow(
        'update failed'
      );
    });
  });

  describe('delete (soft delete invariant)', () => {
    const actor = { username: 'alice' };

    it('sets record_status=Deleted with deleted_by/deleted_at, scoped by record_status=Active, and never hard-deletes', async () => {
      const { calls } = setupClient({ data: null, error: null });
      const repository = new SupabaseMaintenanceRepository();

      await repository.delete('rec-1', actor);

      const updateCall = calls.find((c) => c.method === 'update');
      const payload = updateCall?.args[0] as Record<string, unknown>;
      expect(payload.record_status).toBe('Deleted');
      expect(payload.deleted_by).toBe('alice');
      expect(typeof payload.deleted_at).toBe('string');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['id', 'rec-1'],
        ['record_status', 'Active'],
      ]);

      // No chain method other than update/eq was used - in particular no
      // hard-delete call, since the mock builder has no `.delete` method at all.
      const methodsUsed = new Set(calls.map((c) => c.method));
      expect(methodsUsed).toEqual(new Set(['update', 'eq']));
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('delete failed') });
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.delete('rec-1', actor)).rejects.toThrow('delete failed');
    });
  });

  describe('findDuplicate', () => {
    it('scopes by serial, pm_interval_id, performed_date, and record_status=Active', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.findDuplicate({
        serial: 'SN-1',
        pmIntervalId: 'interval-1',
        performedDate: '2026-01-01',
      });

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['record_status', 'Active'],
        ['serial', 'SN-1'],
        ['pm_interval_id', 'interval-1'],
        ['performed_date', '2026-01-01'],
      ]);
      expect(result).toEqual(activeRecord);
    });

    it('returns null when no duplicate exists', async () => {
      setupClient({ data: null, error: null });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.findDuplicate({
        serial: 'SN-1',
        pmIntervalId: 'interval-1',
        performedDate: '2026-01-01',
      });

      expect(result).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down') });
      const repository = new SupabaseMaintenanceRepository();

      await expect(
        repository.findDuplicate({ serial: 'SN-1', pmIntervalId: 'interval-1', performedDate: '2026-01-01' })
      ).rejects.toThrow('db down');
    });
  });

  describe('listHistory', () => {
    it('always filters record_status=Active and paginates via range', async () => {
      const { calls } = setupClient({ data: [activeRecord], error: null, count: 1 });
      const repository = new SupabaseMaintenanceRepository();

      const result = await repository.listHistory({ page: 2, pageSize: 25 });

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([['record_status', 'Active']]);
      const rangeCall = calls.find((c) => c.method === 'range');
      expect(rangeCall?.args).toEqual([25, 49]);
      expect(result).toEqual({ data: [activeRecord], total: 1 });
    });

    it('applies advanced filters and the universal search across the documented columns', async () => {
      const { calls } = setupClient({ data: [], error: null, count: 0 });
      const repository = new SupabaseMaintenanceRepository();

      await repository.listHistory({
        page: 1,
        pageSize: 25,
        dealerId: 'D1',
        branchId: 'B1',
        technicianId: 'tech-1',
        pmIntervalId: 'interval-1',
        createdBy: 'alice',
        status: 'Completed',
        hourMeterMin: 10,
        hourMeterMax: 500,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        search: 'somchai',
      });

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['record_status', 'Active'],
        ['dealer_id', 'D1'],
        ['branch_id', 'B1'],
        ['technician_id', 'tech-1'],
        ['pm_interval_id', 'interval-1'],
        ['created_by', 'alice'],
        ['status', 'Completed'],
      ]);
      const orCall = calls.find((c) => c.method === 'or');
      expect(orCall?.args[0]).toContain('pm_number.ilike.%somchai%');
      expect(orCall?.args[0]).toContain('technician_name.ilike.%somchai%');
    });

    it('caps pageSize at 200 and floors page at 1', async () => {
      const { calls } = setupClient({ data: [], error: null, count: 0 });
      const repository = new SupabaseMaintenanceRepository();

      await repository.listHistory({ page: 0, pageSize: 10000 });

      const rangeCall = calls.find((c) => c.method === 'range');
      expect(rangeCall?.args).toEqual([0, 199]);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down'), count: 0 });
      const repository = new SupabaseMaintenanceRepository();

      await expect(repository.listHistory({ page: 1, pageSize: 25 })).rejects.toThrow('db down');
    });
  });
});
