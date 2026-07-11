import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../types';

/**
 * MSEAL Design Framework (ADR-023) Platform Overview KPIs -
 * `countVehiclesForSession`/`countOpenQualityCases`. Mirrors
 * `applyScope.test.ts`'s filtering-query-builder mock (a real in-memory
 * filter as `.eq()`/`.in()` accumulate, resolved via `count`), extended
 * with `.in()` since `countOpenQualityCases` filters open statuses before
 * scoping.
 */
function createFilteringQueryBuilder(rows: Record<string, unknown>[]) {
  let filtered = rows;
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((col: string, val: unknown) => {
    filtered = filtered.filter((r) => r[col] === val);
    return builder;
  });
  builder.in = vi.fn((col: string, vals: unknown[]) => {
    filtered = filtered.filter((r) => vals.includes(r[col]));
    return builder;
  });
  builder.then = (onFulfilled: (value: { data: unknown; error: null; count: number }) => unknown) =>
    Promise.resolve({ data: filtered, error: null, count: filtered.length }).then(onFulfilled);
  return builder;
}

const mockFrom = vi.fn();
vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { countVehiclesForSession, countOpenQualityCases } from '../db';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'x',
    fullName: 'X',
    role: 'DealerUser',
    dealerId: 'D1',
    branch: null,
    branchId: null,
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

const VEHICLES = [
  { id: 'v1', dealer_id: 'D1' },
  { id: 'v2', dealer_id: 'D1' },
  { id: 'v3', dealer_id: 'D2' },
];

const RECORDS = [
  { id: 'r1', dealer_id: 'D1', record_status: 'Active', status: 'Open' },
  { id: 'r2', dealer_id: 'D1', record_status: 'Active', status: 'Closed' },
  { id: 'r3', dealer_id: 'D1', record_status: 'Active', status: 'WaitingParts' },
  { id: 'r4', dealer_id: 'D2', record_status: 'Active', status: 'Open' },
];

describe('countVehiclesForSession', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => createFilteringQueryBuilder(VEHICLES.map((r) => ({ ...r }))));
  });

  it('scopes a DealerUser/DealerAdmin to their own dealer', async () => {
    const count = await countVehiclesForSession(session({ role: 'DealerAdmin', dealerId: 'D1' }));
    expect(count).toBe(2);
  });

  it('gives SuperAdmin/CentralAdmin the platform-wide total', async () => {
    const count = await countVehiclesForSession(session({ role: 'SuperAdmin', dealerId: null }));
    expect(count).toBe(3);
  });

  it('a DealerUser/DealerAdmin with no dealerId sees zero, not everything', async () => {
    const count = await countVehiclesForSession(session({ role: 'DealerAdmin', dealerId: null as unknown as string }));
    expect(count).toBe(0);
  });
});

describe('countOpenQualityCases', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => createFilteringQueryBuilder(RECORDS.map((r) => ({ ...r }))));
  });

  it('counts only open statuses, scoped to the session dealer', async () => {
    const count = await countOpenQualityCases(session({ role: 'DealerAdmin', dealerId: 'D1' }));
    // r1 (Open) + r3 (WaitingParts) are open; r2 (Closed) is not; r4 is a different dealer.
    expect(count).toBe(2);
  });

  it('SuperAdmin sees open cases across every dealer', async () => {
    const count = await countOpenQualityCases(session({ role: 'SuperAdmin', dealerId: null }));
    expect(count).toBe(3);
  });
});
