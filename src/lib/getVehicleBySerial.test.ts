import { describe, it, expect, vi } from 'vitest';
import type { SessionUser } from './types';

const mockFrom = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { getVehicleBySerial } from './db';
import { resolveDealerScope, UNRESTRICTED_SCOPE, AuthorizationScope } from './dealerBranchScope';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return { username: 'alice', fullName: 'Alice', role: 'DealerUser', dealerId: 'D1', branch: null, branchId: 'B1', ...overrides };
}

function mockVehicle(dealerId: string | null) {
  const builder: Record<string, unknown> = {};
  const chain = ['select', 'eq'] as const;
  for (const m of chain) builder[m] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'V1', serial: 'S1', dealer_id: dealerId }, error: null }));
  mockFrom.mockReturnValue(builder);
}

describe('getVehicleBySerial - authorization regression', () => {
  it('own dealer: a dealer-scoped role can read a vehicle belonging to their own dealer', async () => {
    mockVehicle('D1');
    const scope: AuthorizationScope = { dealerId: 'D1', unrestricted: false };
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).not.toBeNull();
  });

  it('different dealer: a dealer-scoped role cannot read a vehicle belonging to a different dealer', async () => {
    mockVehicle('D2');
    const scope: AuthorizationScope = { dealerId: 'D1', unrestricted: false };
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).toBeNull();
  });

  it('missing dealer on the vehicle row: visible regardless of scope (no dealer_id to compare against)', async () => {
    mockVehicle(null);
    const scope: AuthorizationScope = { dealerId: 'D1', unrestricted: false };
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).not.toBeNull();
  });

  it('invalid/unknown dealer requested: treated the same as "different dealer" - blocked, not a crash', async () => {
    mockVehicle('D2');
    const scope: AuthorizationScope = { dealerId: 'DOES_NOT_EXIST', unrestricted: false };
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).toBeNull();
  });

  it('unrestricted access: bypasses dealer filtering completely, even when dealerId is set on the scope', async () => {
    mockVehicle('D2');
    const scope: AuthorizationScope = { dealerId: 'D1', unrestricted: true };
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).not.toBeNull();
  });

  it('UNRESTRICTED_SCOPE constant: bypasses dealer filtering for a deliberately-unscoped lookup', async () => {
    mockVehicle('D2');
    const vehicle = await getVehicleBySerial('S1', UNRESTRICTED_SCOPE);
    expect(vehicle).not.toBeNull();
  });

  it('regression: a SuperAdmin whose own session.dealerId is non-null must still see every dealer (the v2.3.2 bug)', async () => {
    mockVehicle('KTV');
    // Before the fix, a caller that passed `session.dealerId` directly
    // (bypassing resolveDealerScope) would incorrectly block this - the bug
    // found during the v2.3.1 production rollout verification.
    const scope = resolveDealerScope(session({ role: 'SuperAdmin', dealerId: 'MSEAL' }), null);
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).not.toBeNull();
  });

  it('regression: a CentralAdmin whose own session.dealerId is non-null must still see every dealer', async () => {
    mockVehicle('KTV');
    const scope = resolveDealerScope(session({ role: 'CentralAdmin', dealerId: 'MSEAL' }), null);
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle).not.toBeNull();
  });
});

describe('getVehicleBySerial - permission matrix', () => {
  const cases: Array<{
    role: SessionUser['role'];
    sessionDealerId: string | null;
    vehicleDealerId: string | null;
    expectVisible: boolean;
    label: string;
  }> = [
    { role: 'DealerUser', sessionDealerId: 'D1', vehicleDealerId: 'D1', expectVisible: true, label: 'DealerUser, own dealer' },
    { role: 'DealerUser', sessionDealerId: 'D1', vehicleDealerId: 'D2', expectVisible: false, label: 'DealerUser, different dealer' },
    { role: 'DealerUser', sessionDealerId: null, vehicleDealerId: 'D2', expectVisible: false, label: 'DealerUser, missing session dealer' },
    { role: 'DealerAdmin', sessionDealerId: 'D1', vehicleDealerId: 'D1', expectVisible: true, label: 'DealerAdmin, own dealer' },
    { role: 'DealerAdmin', sessionDealerId: 'D1', vehicleDealerId: 'D2', expectVisible: false, label: 'DealerAdmin, different dealer' },
    { role: 'CentralAdmin', sessionDealerId: 'MSEAL', vehicleDealerId: 'D1', expectVisible: true, label: 'CentralAdmin, unrestricted despite own dealerId' },
    { role: 'CentralAdmin', sessionDealerId: null, vehicleDealerId: 'D1', expectVisible: true, label: 'CentralAdmin, unrestricted, no own dealerId' },
    { role: 'SuperAdmin', sessionDealerId: 'MSEAL', vehicleDealerId: 'D1', expectVisible: true, label: 'SuperAdmin, unrestricted despite own dealerId' },
    { role: 'SuperAdmin', sessionDealerId: null, vehicleDealerId: 'D1', expectVisible: true, label: 'SuperAdmin, unrestricted, no own dealerId' },
  ];

  it.each(cases)('$label', async ({ role, sessionDealerId, vehicleDealerId, expectVisible }) => {
    mockVehicle(vehicleDealerId);
    const scope = resolveDealerScope(session({ role, dealerId: sessionDealerId }), null);
    const vehicle = await getVehicleBySerial('S1', scope);
    expect(vehicle !== null).toBe(expectVisible);
  });
});
