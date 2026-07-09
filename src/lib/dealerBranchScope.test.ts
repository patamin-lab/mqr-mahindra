import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from './types';

const mockFrom = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { resolveDealerScope, resolveBranchScope, canAccessDealerBranch, assertBranchAccess } from './dealerBranchScope';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return { username: 'alice', fullName: 'Alice', role: 'DealerUser', dealerId: 'D1', branch: null, branchId: 'B1', sessionId: 'test-session', forcePasswordChange: false, ...overrides };
}

describe('resolveDealerScope', () => {
  it('lets SuperAdmin request any dealer (or none = all), and marks the scope unrestricted', () => {
    expect(resolveDealerScope(session({ role: 'SuperAdmin', dealerId: null }), 'D9')).toEqual({ dealerId: 'D9', unrestricted: true });
    expect(resolveDealerScope(session({ role: 'SuperAdmin', dealerId: null }), null)).toEqual({ dealerId: null, unrestricted: true });
  });

  it('marks SuperAdmin unrestricted even when their own session has a non-null dealerId (the v2.3.2 bug)', () => {
    // A SuperAdmin account can itself belong to a dealer (e.g. the head-office
    // dealer) - `unrestricted` must still be true, since a consumer that
    // naively compared session.dealerId directly (bypassing this function)
    // was exactly the bug this scope type exists to prevent.
    expect(resolveDealerScope(session({ role: 'SuperAdmin', dealerId: 'MSEAL' }), null)).toEqual({ dealerId: null, unrestricted: true });
  });

  it('lets CentralAdmin request any dealer, and marks the scope unrestricted', () => {
    expect(resolveDealerScope(session({ role: 'CentralAdmin', dealerId: null }), 'D9')).toEqual({ dealerId: 'D9', unrestricted: true });
  });

  it('pins DealerAdmin to their own session dealer regardless of what is requested', () => {
    expect(resolveDealerScope(session({ role: 'DealerAdmin', dealerId: 'D1' }), 'OTHER_DEALER')).toEqual({ dealerId: 'D1', unrestricted: false });
  });

  it('pins DealerUser to their own session dealer regardless of what is requested', () => {
    expect(resolveDealerScope(session({ role: 'DealerUser', dealerId: 'D1' }), 'OTHER_DEALER')).toEqual({ dealerId: 'D1', unrestricted: false });
  });
});

describe('resolveBranchScope', () => {
  it('pins DealerUser to their own session branch regardless of what is requested', () => {
    expect(resolveBranchScope(session({ role: 'DealerUser', branchId: 'B1' }), 'D1', 'OTHER_BRANCH')).toEqual({ branchId: 'B1', isPinned: true });
  });

  it('a DealerUser with no assigned branch resolves to null (never "unrestricted")', () => {
    expect(resolveBranchScope(session({ role: 'DealerUser', branchId: null }), 'D1', 'OTHER_BRANCH')).toEqual({ branchId: null, isPinned: true });
  });

  it('lets DealerAdmin request any branch within their dealer', () => {
    expect(resolveBranchScope(session({ role: 'DealerAdmin' }), 'D1', 'B2')).toEqual({ branchId: 'B2', isPinned: false });
  });

  it('lets SuperAdmin request any branch (or none = all)', () => {
    expect(resolveBranchScope(session({ role: 'SuperAdmin' }), 'D1', 'B2')).toEqual({ branchId: 'B2', isPinned: false });
    expect(resolveBranchScope(session({ role: 'SuperAdmin' }), 'D1', null)).toEqual({ branchId: null, isPinned: false });
  });
});

describe('canAccessDealerBranch', () => {
  it('SuperAdmin can access any dealer/branch', () => {
    expect(canAccessDealerBranch(session({ role: 'SuperAdmin', dealerId: null }), 'D9', 'B9')).toBe(true);
  });

  it('DealerAdmin can access every branch within their own dealer', () => {
    const s = session({ role: 'DealerAdmin', dealerId: 'D1' });
    expect(canAccessDealerBranch(s, 'D1', 'B1')).toBe(true);
    expect(canAccessDealerBranch(s, 'D1', 'B2')).toBe(true);
    expect(canAccessDealerBranch(s, 'D1', null)).toBe(true);
  });

  it('DealerAdmin cannot access another dealer', () => {
    const s = session({ role: 'DealerAdmin', dealerId: 'D1' });
    expect(canAccessDealerBranch(s, 'D2', 'B1')).toBe(false);
  });

  it('DealerUser can access a record in their own branch', () => {
    const s = session({ role: 'DealerUser', dealerId: 'D1', branchId: 'B1' });
    expect(canAccessDealerBranch(s, 'D1', 'B1')).toBe(true);
  });

  it('DealerUser cannot access a record in a different branch, same dealer', () => {
    const s = session({ role: 'DealerUser', dealerId: 'D1', branchId: 'B1' });
    expect(canAccessDealerBranch(s, 'D1', 'B2')).toBe(false);
  });

  it('DealerUser cannot access another dealer entirely', () => {
    const s = session({ role: 'DealerUser', dealerId: 'D1', branchId: 'B1' });
    expect(canAccessDealerBranch(s, 'D2', 'B1')).toBe(false);
  });

  it('DealerUser with no assigned branch (null) can never access anything - fail closed, not fail open', () => {
    const s = session({ role: 'DealerUser', dealerId: 'D1', branchId: null });
    expect(canAccessDealerBranch(s, 'D1', null)).toBe(false);
    expect(canAccessDealerBranch(s, 'D1', 'B1')).toBe(false);
  });
});

describe('assertBranchAccess', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('resolves without throwing when no branchId is requested', async () => {
    await expect(assertBranchAccess('D1', null)).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when a branchId is requested but no dealerId was resolved', async () => {
    await expect(assertBranchAccess(null, 'B1')).rejects.toThrow('FORBIDDEN_BRANCH');
  });

  it('resolves when the branch belongs to the dealer', async () => {
    const builder: Record<string, unknown> = {};
    const chain = ['select', 'eq'] as const;
    for (const m of chain) builder[m] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'B1' }, error: null }));
    mockFrom.mockReturnValue(builder);

    await expect(assertBranchAccess('D1', 'B1')).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN_BRANCH when the branch does not belong to the dealer', async () => {
    const builder: Record<string, unknown> = {};
    const chain = ['select', 'eq'] as const;
    for (const m of chain) builder[m] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    mockFrom.mockReturnValue(builder);

    await expect(assertBranchAccess('D1', 'OTHER_DEALER_BRANCH')).rejects.toThrow('FORBIDDEN_BRANCH');
  });
});
