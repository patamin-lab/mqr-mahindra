import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../types';

/**
 * A query-builder mock that actually *filters* an in-memory fixture array
 * as `.eq()` calls accumulate (rather than just recording calls), so these
 * tests exercise real dealer/branch-scoping behavior end-to-end through
 * `listRecordsPaginated()` - the 4 regression assertions the Dealer/Branch
 * Scope Platform Standard requires (DealerUser same-branch access,
 * DealerUser cross-branch denial, DealerAdmin full-dealer access,
 * SuperAdmin full access) - without a live Supabase round-trip, consistent
 * with every other test in this file mocking `../supabase`.
 */
function createFilteringQueryBuilder(rows: Record<string, unknown>[]) {
  let filtered = rows;
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.eq = vi.fn((col: string, val: unknown) => {
    filtered = filtered.filter((r) => r[col] === val);
    return builder;
  });
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.range = vi.fn(() => builder);
  builder.then = (onFulfilled: (value: { data: unknown; error: null; count: number }) => unknown) =>
    Promise.resolve({ data: filtered, error: null, count: filtered.length }).then(onFulfilled);
  return builder;
}

const mockFrom = vi.fn();
vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { listRecordsPaginated } from '../db';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return { username: 'x', fullName: 'X', role: 'DealerUser', dealerId: 'D1', branch: null, branchId: null, sessionId: 'test-session', forcePasswordChange: false, ...overrides };
}

const FIXTURE = [
  { id: 'r1', dealer_id: 'D1', branch_id: 'B1', created_by: 'userA', record_status: 'Active' },
  { id: 'r2', dealer_id: 'D1', branch_id: 'B1', created_by: 'userB', record_status: 'Active' },
  { id: 'r3', dealer_id: 'D1', branch_id: 'B2', created_by: 'userC', record_status: 'Active' },
  { id: 'r4', dealer_id: 'D2', branch_id: 'B3', created_by: 'userD', record_status: 'Active' },
];

describe('Dealer/Branch Scope regression suite (applyScope via listRecordsPaginated)', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => createFilteringQueryBuilder(FIXTURE.map((r) => ({ ...r }))));
  });

  it('DealerUser A can see DealerUser B\'s record in the same branch (branch is the team boundary, not the individual)', async () => {
    const userA = session({ username: 'userA', dealerId: 'D1', branchId: 'B1' });
    const result = await listRecordsPaginated(userA, {});
    const ids = result.records.map((r: any) => r.id);
    expect(ids).toContain('r1'); // own record
    expect(ids).toContain('r2'); // colleague's record, same branch
  });

  it('DealerUser cannot see a record in a different branch of the same dealer', async () => {
    const userA = session({ username: 'userA', dealerId: 'D1', branchId: 'B1' });
    const result = await listRecordsPaginated(userA, {});
    const ids = result.records.map((r: any) => r.id);
    expect(ids).not.toContain('r3'); // different branch, same dealer
    expect(ids).not.toContain('r4'); // different dealer entirely
  });

  it('DealerAdmin sees every branch within their own dealer', async () => {
    const admin = session({ role: 'DealerAdmin', dealerId: 'D1', branchId: null });
    const result = await listRecordsPaginated(admin, {});
    const ids = result.records.map((r: any) => r.id);
    expect(ids.sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('SuperAdmin sees everything across dealers and branches', async () => {
    const superAdmin = session({ role: 'SuperAdmin', dealerId: null, branchId: null });
    const result = await listRecordsPaginated(superAdmin, {});
    const ids = result.records.map((r: any) => r.id);
    expect(ids.sort()).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('a DealerUser with no assigned branch (null) sees nothing - fail closed, not fail open', async () => {
    const unassigned = session({ username: 'newHire', dealerId: 'D1', branchId: null });
    const result = await listRecordsPaginated(unassigned, {});
    expect(result.records).toHaveLength(0);
  });
});
