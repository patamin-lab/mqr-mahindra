import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
}

/**
 * Fake Supabase query builder. Chain methods (select/eq/order/insert/update)
 * record their calls and return the same builder, matching the real
 * supabase-js fluent API. `.single()`/`.maybeSingle()` resolve to the
 * configured result, and the builder itself is thenable so `await query`
 * also resolves to it - matching how the repository awaits `list()`/
 * `delete()` without a terminal `.single()` call.
 *
 * Deliberately has no `.delete()` method: if SupabasePmRecordRepository
 * ever called a real hard delete instead of a soft-delete `update()`, this
 * mock would throw "not a function" and fail the test loudly.
 */
function createQueryBuilder(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'order', 'insert', 'update'] as const;

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

function mockGetSupabase(result: QueryResult) {
  const { builder, calls } = createQueryBuilder(result);
  const from = vi.fn(() => builder);
  return { client: { from }, builder, calls };
}

const state: { client: { from: ReturnType<typeof vi.fn> } | null } = { client: null };

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

// Imported after the mock is registered so the repository picks it up.
const { SupabasePmRecordRepository } = await import('./supabaseRepository');

function setupClient(result: QueryResult) {
  const mocked = mockGetSupabase(result);
  state.client = mocked.client as unknown as { from: ReturnType<typeof vi.fn> };
  return mocked;
}

const activeRecord = {
  id: 'rec-1',
  dealer_id: 'D1',
  branch_id: null,
  serial: null,
  technician_id: null,
  scheduled_date: null,
  performed_date: null,
  status: 'Scheduled',
  notes: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
  record_status: 'Active',
};

describe('SupabasePmRecordRepository', () => {
  beforeEach(() => {
    state.client = null;
  });

  describe('list', () => {
    it('always filters record_status=Active, with no other filters applied by default', async () => {
      const { client, calls } = setupClient({ data: [activeRecord], error: null });
      const repository = new SupabasePmRecordRepository();

      const result = await repository.list();

      const eqCalls = calls.filter((c) => c.method === 'eq').map((c) => c.args);
      expect(eqCalls).toEqual([['record_status', 'Active']]);
      expect(result).toEqual([activeRecord]);
    });

    it('applies dealerId, branchId, and status filters when provided', async () => {
      const { calls } = setupClient({ data: [], error: null });
      const repository = new SupabasePmRecordRepository();

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
      const repository = new SupabasePmRecordRepository();

      await expect(repository.list()).rejects.toThrow('db down');
    });
  });

  describe('getById', () => {
    it('returns the record when active', async () => {
      setupClient({ data: activeRecord, error: null });
      const repository = new SupabasePmRecordRepository();

      const result = await repository.getById('rec-1');

      expect(result).toEqual(activeRecord);
    });

    it('returns null when the record is soft-deleted', async () => {
      setupClient({ data: { ...activeRecord, record_status: 'Deleted' }, error: null });
      const repository = new SupabasePmRecordRepository();

      const result = await repository.getById('rec-1');

      expect(result).toBeNull();
    });

    it('returns null when no row is found', async () => {
      setupClient({ data: null, error: null });
      const repository = new SupabasePmRecordRepository();

      const result = await repository.getById('missing');

      expect(result).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('db down') });
      const repository = new SupabasePmRecordRepository();

      await expect(repository.getById('rec-1')).rejects.toThrow('db down');
    });
  });

  describe('create', () => {
    const input = {
      dealer_id: 'D1',
      branch_id: null,
      serial: null,
      technician_id: null,
      scheduled_date: null,
      status: 'Scheduled',
      notes: null,
    };
    const actor = { username: 'alice' };

    it('inserts a payload with a generated id and record_status=Active', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null });
      const repository = new SupabasePmRecordRepository();

      const result = await repository.create(input, actor);

      const insertCall = calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(typeof payload.id).toBe('string');
      expect(payload).toMatchObject({
        dealer_id: 'D1',
        status: 'Scheduled',
        created_by: 'alice',
        updated_by: 'alice',
        record_status: 'Active',
      });
      expect(result).toEqual(activeRecord);
    });

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('insert failed') });
      const repository = new SupabasePmRecordRepository();

      await expect(repository.create(input, actor)).rejects.toThrow('insert failed');
    });
  });

  describe('update', () => {
    const actor = { username: 'alice' };

    it('only includes fields present on the input, plus updated_by/updated_at, and scopes by record_status=Active', async () => {
      const { calls } = setupClient({ data: activeRecord, error: null });
      const repository = new SupabasePmRecordRepository();

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

    it('throws when Supabase returns an error', async () => {
      setupClient({ data: null, error: new Error('update failed') });
      const repository = new SupabasePmRecordRepository();

      await expect(repository.update('rec-1', { status: 'Completed' }, actor)).rejects.toThrow(
        'update failed'
      );
    });
  });

  describe('delete (soft delete invariant)', () => {
    const actor = { username: 'alice' };

    it('sets record_status=Deleted with deleted_by/deleted_at, scoped by record_status=Active, and never hard-deletes', async () => {
      const { calls } = setupClient({ data: null, error: null });
      const repository = new SupabasePmRecordRepository();

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
      const repository = new SupabasePmRecordRepository();

      await expect(repository.delete('rec-1', actor)).rejects.toThrow('delete failed');
    });
  });
});
