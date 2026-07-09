import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'insert', 'update'] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { consumeInvitationToken, generateInvitationToken, unusablePlaceholderPasswordHash, validateInvitationToken } from '../invitationService';

describe('generateInvitationToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('stores purpose=invitation, only the token hash, expiring in ~7 days, tagged with who invited', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const token = await generateInvitationToken('user-1', 'admin1');

    const insertCall = calls.find((c) => c.method === 'insert');
    const inserted = insertCall?.args[0] as { user_id: string; purpose: string; token_hash: string; expires_at: string; created_by: string };
    expect(inserted.purpose).toBe('invitation');
    expect(inserted.created_by).toBe('admin1');
    expect(inserted.token_hash).not.toBe(token);

    const expiresInDays = (new Date(inserted.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(expiresInDays).toBeGreaterThan(6.9);
    expect(expiresInDays).toBeLessThanOrEqual(7);
  });
});

describe('validateInvitationToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('rejects an unknown token', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: null }).builder);
    expect(await validateInvitationToken('nope')).toEqual({ valid: false, reason: 'not_found' });
  });

  it('rejects an already-accepted invitation', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: { user_id: 'u1', expires_at: new Date(Date.now() + 1000).toISOString(), used_at: '2026-01-01T00:00:00Z' },
        error: null,
      }).builder
    );
    expect(await validateInvitationToken('used')).toEqual({ valid: false, reason: 'used' });
  });

  it('rejects an expired invitation', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({ data: { user_id: 'u1', expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null }, error: null }).builder
    );
    expect(await validateInvitationToken('expired')).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a valid, unused, unexpired invitation', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({ data: { user_id: 'u1', expires_at: new Date(Date.now() + 1000).toISOString(), used_at: null }, error: null }).builder
    );
    expect(await validateInvitationToken('good')).toEqual({ valid: true, userId: 'u1' });
  });
});

describe('consumeInvitationToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('marks the invitation used_at', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    await consumeInvitationToken('token');
    expect(calls.find((c) => c.method === 'update')?.args[0]).toHaveProperty('used_at');
  });
});

describe('unusablePlaceholderPasswordHash', () => {
  it('is never the same twice and can never equal a real sha256/scrypt hash format collision in practice', () => {
    const a = unusablePlaceholderPasswordHash();
    const b = unusablePlaceholderPasswordHash();
    expect(a).not.toBe(b);
    expect(a.startsWith('invitation-pending:')).toBe(true);
  });
});
