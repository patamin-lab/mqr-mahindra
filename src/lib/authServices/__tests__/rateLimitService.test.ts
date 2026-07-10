import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  count: number | null;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'in', 'gte'] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { isRateLimited } from '../rateLimitService';

describe('isRateLimited', () => {
  beforeEach(() => mockFrom.mockReset());

  it('fails open (never limited) when there is no IP to attribute the request to', async () => {
    expect(await isRateLimited(null, ['LOGIN_FAILED'], 15, 5)).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('is not limited when the count is under the threshold', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ count: 4, error: null }).builder);
    expect(await isRateLimited('1.2.3.4', ['LOGIN_FAILED'], 15, 5)).toBe(false);
  });

  it('is limited once the count reaches the threshold', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ count: 5, error: null }).builder);
    expect(await isRateLimited('1.2.3.4', ['LOGIN_FAILED'], 15, 5)).toBe(true);
  });

  it('scopes the count to the given IP and event types', async () => {
    const { builder, calls } = createQueryBuilder({ count: 0, error: null });
    mockFrom.mockReturnValue(builder);

    await isRateLimited('9.9.9.9', ['LOGIN_SUCCESS', 'LOGIN_FAILED'], 15, 30);

    expect(mockFrom).toHaveBeenCalledWith('auth_audit_log');
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'ip_address' && c.args[1] === '9.9.9.9')).toBe(true);
    expect(calls.some((c) => c.method === 'in' && c.args[0] === 'event_type' && Array.isArray(c.args[1]))).toBe(true);
  });

  it('throws (fails closed) when the underlying query errors', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ count: null, error: new Error('boom') }).builder);
    await expect(isRateLimited('1.2.3.4', ['LOGIN_FAILED'], 15, 5)).rejects.toThrow('boom');
  });
});
