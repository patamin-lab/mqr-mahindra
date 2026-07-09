import { describe, it, expect, vi } from 'vitest';

/** Minimal fake Supabase client - this file only covers `delete()`, which
 *  calls `soft_delete_ntr_record()` via `.rpc()` rather than the query
 *  builder, so no chainable builder mock is needed (see that method's own
 *  doc comment for why: a confirmed Postgres/Supabase-level anomaly
 *  rejects the `anon` role's direct UPDATE of this transition). */
function mockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { client: { rpc }, rpc };
}

const state: { client: { rpc: ReturnType<typeof vi.fn> } | null } = { client: null };

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => state.client,
}));

const { SupabaseNtrRepository } = await import('./supabaseNtrRepository');

function setupClient(rpcResult: { data: unknown; error: unknown }) {
  const mocked = mockClient(rpcResult);
  state.client = mocked.client;
  return mocked;
}

describe('SupabaseNtrRepository.delete (soft delete via soft_delete_ntr_record RPC)', () => {
  const actor = { username: 'alice' };

  it('calls the soft_delete_ntr_record RPC with id/actor/reason, never a direct update', async () => {
    const { rpc } = setupClient({ data: {}, error: null });
    const repository = new SupabaseNtrRepository();

    await repository.delete('rec-1', actor, 'duplicate entry');

    expect(rpc).toHaveBeenCalledWith('soft_delete_ntr_record', {
      p_id: 'rec-1',
      p_actor: 'alice',
      p_reason: 'duplicate entry',
    });
  });

  it('throws a clean "not found" error when the RPC reports NTR_NOT_FOUND', async () => {
    setupClient({ data: null, error: new Error('NTR_NOT_FOUND: record rec-1 not found') });
    const repository = new SupabaseNtrRepository();

    await expect(repository.delete('rec-1', actor)).rejects.toThrow('NTR record not found');
  });

  it('throws a clean "already deleted" error when the RPC reports NTR_ALREADY_DELETED', async () => {
    setupClient({ data: null, error: new Error('NTR_ALREADY_DELETED: record rec-1 is already deleted') });
    const repository = new SupabaseNtrRepository();

    await expect(repository.delete('rec-1', actor)).rejects.toThrow('NTR record is already deleted');
  });

  it('propagates any other RPC error unchanged', async () => {
    setupClient({ data: null, error: new Error('connection reset') });
    const repository = new SupabaseNtrRepository();

    await expect(repository.delete('rec-1', actor)).rejects.toThrow('connection reset');
  });
});

/** Dealer/Branch Scope Platform Standard - `getById`/`listHistory` accept
 *  an optional `session` and, when passed, enforce the same
 *  dealer/branch authorization every other module now shares (see
 *  `lib/dealerBranchScope.ts`). Optional only for back-compat with NTR's
 *  API routes, not yet migrated to pass it (a later phase's work). */
describe('SupabaseNtrRepository branch scoping (session param)', () => {
  function fromMock(rows: Record<string, unknown>[]) {
    let filtered = rows;
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] === val);
      return builder;
    });
    builder.order = vi.fn(() => builder);
    builder.range = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: filtered[0] ?? null, error: null }));
    builder.then = (onFulfilled: (v: { data: unknown; error: null; count: number }) => unknown) =>
      Promise.resolve({ data: filtered, error: null, count: filtered.length }).then(onFulfilled);
    return builder;
  }

  function session(overrides: Record<string, unknown> = {}) {
    return { username: 'x', fullName: 'X', role: 'DealerUser', dealerId: 'D1', branch: null, branchId: 'B1', ...overrides };
  }

  it('getById returns null when the record is outside the DealerUser\'s branch', async () => {
    const from = vi.fn(() => fromMock([{ id: 'ntr-1', record_status: 'Active', dealer_id: 'D1', branch_id: 'B2' }]));
    state.client = { rpc: vi.fn(), from } as unknown as { rpc: ReturnType<typeof vi.fn> };
    const repository = new SupabaseNtrRepository();

    const result = await repository.getById('ntr-1', session({ branchId: 'B1' }) as any);
    expect(result).toBeNull();
  });

  it('getById returns the record when it belongs to the DealerUser\'s own branch', async () => {
    const from = vi.fn(() => fromMock([{ id: 'ntr-1', record_status: 'Active', dealer_id: 'D1', branch_id: 'B1' }]));
    state.client = { rpc: vi.fn(), from } as unknown as { rpc: ReturnType<typeof vi.fn> };
    const repository = new SupabaseNtrRepository();

    const result = await repository.getById('ntr-1', session({ branchId: 'B1' }) as any);
    expect(result).not.toBeNull();
  });

  it('getById is unaffected when session is omitted (back-compat)', async () => {
    const from = vi.fn(() => fromMock([{ id: 'ntr-1', record_status: 'Active', dealer_id: 'D1', branch_id: 'B2' }]));
    state.client = { rpc: vi.fn(), from } as unknown as { rpc: ReturnType<typeof vi.fn> };
    const repository = new SupabaseNtrRepository();

    const result = await repository.getById('ntr-1');
    expect(result).not.toBeNull();
  });
});

