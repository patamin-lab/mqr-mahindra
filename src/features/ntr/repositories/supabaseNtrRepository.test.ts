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
