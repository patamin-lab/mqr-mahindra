import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../types';

function createQueryBuilder(result: { data: unknown; error: unknown; count: number }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'order', 'or', 'gte', 'lte', 'range'] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.then = (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { listRecordsPaginated } from '../db';

const dealerAdmin: SessionUser = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerAdmin',
  dealerId: 'D1',
  branch: null,
};

describe('listRecordsPaginated', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('defaults to page 1 / pageSize 50 and applies a range() of [0, 49]', async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);

    const result = await listRecordsPaginated(dealerAdmin, {});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    const rangeCall = calls.find((c) => c.method === 'range');
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it('clamps an oversized pageSize to 200', async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);

    await listRecordsPaginated(dealerAdmin, { pageSize: 10000, page: 2 });

    const rangeCall = calls.find((c) => c.method === 'range');
    // page 2, pageSize 200 -> from 200, to 399
    expect(rangeCall?.args).toEqual([200, 399]);
  });

  it('applies dateFrom/dateTo as gte/lte on found_date', async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);

    await listRecordsPaginated(dealerAdmin, { dateFrom: '2026-01-01', dateTo: '2026-01-31' });

    expect(calls.some((c) => c.method === 'gte' && c.args[0] === 'found_date' && c.args[1] === '2026-01-01')).toBe(true);
    expect(calls.some((c) => c.method === 'lte' && c.args[0] === 'found_date' && c.args[1] === '2026-01-31')).toBe(true);
  });

  it('returns the total count reported by the query, not just the page length', async () => {
    const rows = [{ id: '1' }, { id: '2' }];
    const { builder } = createQueryBuilder({ data: rows, error: null, count: 137 });
    mockFrom.mockReturnValue(builder);

    const result = await listRecordsPaginated(dealerAdmin, {});
    expect(result.records).toHaveLength(2);
    expect(result.total).toBe(137);
  });

  it('does not let a non-privileged role override dealer scope via dealerId filter', async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);

    await listRecordsPaginated(dealerAdmin, { dealerId: 'OTHER_DEALER' });

    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'dealer_id' && c.args[1] === 'OTHER_DEALER')).toBe(false);
    // Scope itself still pins to the session's own dealer.
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'dealer_id' && c.args[1] === 'D1')).toBe(true);
  });
});
