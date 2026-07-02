import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: number;
}

/**
 * Fake Supabase query builder - same shape as
 * `src/features/pm-record/supabaseRepository.test.ts`'s harness. Deliberately
 * has no `.delete()` method: if the repository ever called a real hard
 * delete instead of a soft-delete `update()`, this mock would throw
 * "not a function" and fail the test loudly.
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

/** `from` dispatches by table name - `vehicle_events` is the primary table
 *  under test, `event_definitions` is a separate lookup used by
 *  `getEventDefinitionByCode()`. */
function mockGetSupabase(result: QueryResult, lookups: Record<string, QueryResult> = {}) {
  const { builder, calls } = createQueryBuilder(result);
  const lookupBuilders: Record<string, ReturnType<typeof createQueryBuilder>> = {};
  const from = vi.fn((table: string) => {
    if (table === 'vehicle_events') return builder;
    if (!lookupBuilders[table]) {
      lookupBuilders[table] = createQueryBuilder(lookups[table] ?? { data: null, error: null });
    }
    return lookupBuilders[table].builder;
  });
  return { client: { from }, builder, calls, lookupBuilders };
}

const state: { client: { from: ReturnType<typeof vi.fn> } | null } = { client: null };

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

// Imported after the mock is registered so the repository picks it up.
const { SupabaseVehicleEventRepository } = await import('./supabaseRepository');

function setupClient(result: QueryResult, lookups?: Record<string, QueryResult>) {
  const mocked = mockGetSupabase(result, lookups);
  state.client = mocked.client as unknown as { from: ReturnType<typeof vi.fn> };
  return mocked;
}

const activeEvent = {
  id: 'evt-1',
  vehicle_id: 'veh-1',
  event_definition_id: 'def-1',
  source_module: 'maintenance',
  reference_id: 'PM-D1-2026-000001',
  event_datetime: '2026-01-01T00:00:00.000Z',
  title: 'บำรุงรักษาเชิงป้องกัน',
  description: null,
  metadata: {},
  status: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
  record_status: 'Active',
};

describe('SupabaseVehicleEventRepository', () => {
  beforeEach(() => {
    state.client = null;
  });

  describe('createEvent', () => {
    const input = {
      vehicle_id: 'veh-1',
      event_definition_id: 'def-1',
      source_module: 'maintenance',
      reference_id: 'PM-D1-2026-000001',
      event_datetime: '2026-01-01T00:00:00.000Z',
      title: 'บำรุงรักษาเชิงป้องกัน',
    };
    const actor = { username: 'alice' };

    it('inserts a payload with a generated id and record_status=Active', async () => {
      const { calls } = setupClient({ data: activeEvent, error: null });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.createEvent(input, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(typeof payload.id).toBe('string');
      expect(payload).toMatchObject({
        vehicle_id: 'veh-1',
        event_definition_id: 'def-1',
        source_module: 'maintenance',
        reference_id: 'PM-D1-2026-000001',
        title: 'บำรุงรักษาเชิงป้องกัน',
        description: null,
        metadata: {},
        status: null,
        created_by: 'alice',
        updated_by: 'alice',
        record_status: 'Active',
      });
      expect(result).toEqual(activeEvent);
    });

    it('defaults description/metadata/status when omitted', async () => {
      const { calls } = setupClient({ data: activeEvent, error: null });
      const repository = new SupabaseVehicleEventRepository();

      await repository.createEvent(input, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(payload.description).toBeNull();
      expect(payload.metadata).toEqual({});
      expect(payload.status).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('insert failed') });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.createEvent(input, actor)).rejects.toThrow('insert failed');
    });
  });

  describe('updateEvent', () => {
    const actor = { username: 'alice' };

    it('only includes fields present on the input, plus updated_by/updated_at, and scopes by record_status=Active', async () => {
      const { calls } = setupClient({ data: activeEvent, error: null });
      const repository = new SupabaseVehicleEventRepository();

      await repository.updateEvent('evt-1', { title: 'Updated' }, actor);

      const updateCall = calls.find((c) => c.method === 'update');
      const payload = updateCall?.args[0] as Record<string, unknown>;
      expect(payload).toEqual(expect.objectContaining({ title: 'Updated', updated_by: 'alice' }));
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('status');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['id', 'evt-1'],
        ['record_status', 'Active'],
      ]);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('update failed') });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.updateEvent('evt-1', { title: 'x' }, actor)).rejects.toThrow('update failed');
    });
  });

  describe('deleteEvent (soft delete invariant)', () => {
    const actor = { username: 'alice' };

    it('sets record_status=Deleted with deleted_by/deleted_at, scoped by record_status=Active, and never hard-deletes', async () => {
      const { calls } = setupClient({ data: null, error: null });
      const repository = new SupabaseVehicleEventRepository();

      await repository.deleteEvent('evt-1', actor);

      const updateCall = calls.find((c) => c.method === 'update');
      const payload = updateCall?.args[0] as Record<string, unknown>;
      expect(payload.record_status).toBe('Deleted');
      expect(payload.deleted_by).toBe('alice');
      expect(typeof payload.deleted_at).toBe('string');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['id', 'evt-1'],
        ['record_status', 'Active'],
      ]);

      const methodsUsed = new Set(calls.map((c) => c.method));
      expect(methodsUsed).toEqual(new Set(['update', 'eq']));
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('delete failed') });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.deleteEvent('evt-1', actor)).rejects.toThrow('delete failed');
    });
  });

  describe('getVehicleEvents', () => {
    it('filters by vehicle_id and record_status=Active, newest first', async () => {
      const { calls } = setupClient({ data: [activeEvent], error: null });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.getVehicleEvents('veh-1');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['vehicle_id', 'veh-1'],
        ['record_status', 'Active'],
      ]);
      expect(result).toEqual([activeEvent]);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down') });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.getVehicleEvents('veh-1')).rejects.toThrow('db down');
    });
  });

  describe('getModuleEvents', () => {
    it('filters by source_module and record_status=Active', async () => {
      const { calls } = setupClient({ data: [activeEvent], error: null });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.getModuleEvents('maintenance');

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['source_module', 'maintenance'],
        ['record_status', 'Active'],
      ]);
      expect(result).toEqual([activeEvent]);
    });
  });

  describe('searchEvents', () => {
    it('always filters record_status=Active and paginates via range, with no dealer join when dealerId is absent', async () => {
      const { calls } = setupClient({ data: [activeEvent], error: null, count: 1 });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.searchEvents({ page: 2, pageSize: 25 });

      const selectCall = calls.find((c) => c.method === 'select');
      expect(selectCall?.args[0]).toBe('*');
      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([['record_status', 'Active']]);
      const rangeCall = calls.find((c) => c.method === 'range');
      expect(rangeCall?.args).toEqual([25, 49]);
      expect(result).toEqual({ data: [activeEvent], total: 1 });
    });

    it('joins vehicles and filters by vehicles.dealer_id when dealerId is provided, stripping the joined field from results', async () => {
      const { calls } = setupClient({ data: [{ ...activeEvent, vehicles: { dealer_id: 'D1' } }], error: null, count: 1 });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.searchEvents({ dealerId: 'D1', page: 1, pageSize: 25 });

      const selectCall = calls.find((c) => c.method === 'select');
      expect(selectCall?.args[0]).toBe('*, vehicles!inner(dealer_id)');
      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['record_status', 'Active'],
        ['vehicles.dealer_id', 'D1'],
      ]);
      expect(result.data[0]).not.toHaveProperty('vehicles');
      expect(result.data).toEqual([activeEvent]);
    });

    it('applies vehicleId/sourceModule/eventDefinitionId/date range/search filters', async () => {
      const { calls } = setupClient({ data: [], error: null, count: 0 });
      const repository = new SupabaseVehicleEventRepository();

      await repository.searchEvents({
        vehicleId: 'veh-1',
        sourceModule: 'maintenance',
        eventDefinitionId: 'def-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        search: 'somchai',
        page: 1,
        pageSize: 25,
      });

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([
        ['record_status', 'Active'],
        ['vehicle_id', 'veh-1'],
        ['source_module', 'maintenance'],
        ['event_definition_id', 'def-1'],
      ]);
      const orCall = calls.find((c) => c.method === 'or');
      expect(orCall?.args[0]).toContain('title.ilike.%somchai%');
    });

    it('caps pageSize at 200 and floors page at 1', async () => {
      const { calls } = setupClient({ data: [], error: null, count: 0 });
      const repository = new SupabaseVehicleEventRepository();

      await repository.searchEvents({ page: 0, pageSize: 10000 });

      const rangeCall = calls.find((c) => c.method === 'range');
      expect(rangeCall?.args).toEqual([0, 199]);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down'), count: 0 });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.searchEvents({ page: 1, pageSize: 25 })).rejects.toThrow('db down');
    });
  });

  describe('getEventDefinitionByCode', () => {
    const definition = {
      id: 'def-1',
      event_code: 'MAINTENANCE_COMPLETED',
      display_name_en: 'Maintenance Completed',
      display_name_th: 'บำรุงรักษาเชิงป้องกัน',
      module: 'maintenance',
      icon: null,
      color: null,
      display_order: 50,
      active: true,
    };

    it('looks up event_definitions by event_code', async () => {
      const { lookupBuilders } = setupClient(
        { data: [activeEvent], error: null },
        { event_definitions: { data: definition, error: null } }
      );
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.getEventDefinitionByCode('MAINTENANCE_COMPLETED');

      expect(lookupBuilders.event_definitions).toBeDefined();
      const calls = lookupBuilders.event_definitions.calls;
      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([['event_code', 'MAINTENANCE_COMPLETED']]);
      expect(result).toEqual(definition);
    });

    it('returns null when no definition matches', async () => {
      setupClient({ data: [activeEvent], error: null }, { event_definitions: { data: null, error: null } });
      const repository = new SupabaseVehicleEventRepository();

      const result = await repository.getEventDefinitionByCode('NOT_A_CODE');

      expect(result).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: [activeEvent], error: null }, { event_definitions: { data: null, error: new Error('db down') } });
      const repository = new SupabaseVehicleEventRepository();

      await expect(repository.getEventDefinitionByCode('MAINTENANCE_COMPLETED')).rejects.toThrow('db down');
    });
  });
});
