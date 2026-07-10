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
  builder.maybeSingle = vi.fn(() => {
    calls.push({ method: 'maybeSingle', args: [] });
    return Promise.resolve(result);
  });
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { consumeResetToken, generateResetToken, validateResetToken } from '../passwordResetService';

describe('generateResetToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('generates a token, stores only its hash (never the raw token), single-use, expiring in ~30 minutes', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const token = await generateResetToken('user-1');

    expect(mockFrom).toHaveBeenCalledWith('auth_tokens');
    const insertCall = calls.find((c) => c.method === 'insert');
    const inserted = insertCall?.args[0] as { user_id: string; purpose: string; token_hash: string; expires_at: string };
    expect(inserted.user_id).toBe('user-1');
    expect(inserted.purpose).toBe('password_reset');
    expect(inserted.token_hash).not.toBe(token);
    expect(inserted.token_hash).toHaveLength(64); // sha256 hex digest length
    expect(token).toHaveLength(64); // randomBytes(32).toString('hex') length

    const expiresInMinutes = (new Date(inserted.expires_at).getTime() - Date.now()) / 60000;
    expect(expiresInMinutes).toBeGreaterThan(29);
    expect(expiresInMinutes).toBeLessThanOrEqual(30);
  });

  it('two generated tokens are never the same (cryptographically random)', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: null }).builder);
    const a = await generateResetToken('user-1');
    const b = await generateResetToken('user-1');
    expect(a).not.toBe(b);
  });
});

describe('validateResetToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('rejects a token that does not exist', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: null }).builder);
    expect(await validateResetToken('nonexistent')).toEqual({ valid: false, reason: 'not_found' });
  });

  it('rejects a token that has already been used', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: { user_id: 'user-1', expires_at: new Date(Date.now() + 60000).toISOString(), used_at: '2026-01-01T00:00:00Z' },
        error: null,
      }).builder
    );
    expect(await validateResetToken('used-token')).toEqual({ valid: false, reason: 'used' });
  });

  it('rejects a token past its expiry', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: { user_id: 'user-1', expires_at: new Date(Date.now() - 60000).toISOString(), used_at: null },
        error: null,
      }).builder
    );
    expect(await validateResetToken('expired-token')).toEqual({ valid: false, reason: 'expired' });
  });

  it('accepts a real, unused, unexpired token', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: { user_id: 'user-1', expires_at: new Date(Date.now() + 60000).toISOString(), used_at: null },
        error: null,
      }).builder
    );
    expect(await validateResetToken('good-token')).toEqual({ valid: true, userId: 'user-1' });
  });
});

describe('consumeResetToken', () => {
  beforeEach(() => mockFrom.mockReset());

  it('marks the token used_at, enforcing single-use', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await consumeResetToken('some-token');

    const updateCall = calls.find((c) => c.method === 'update');
    expect(updateCall?.args[0]).toHaveProperty('used_at');
  });
});
