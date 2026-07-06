import { describe, it, expect } from 'vitest';
import { parseMaintenanceHistoryFilterFromSearchParams } from '../utils/parseHistoryFilter';
import type { SessionUser } from '@/lib/types';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return { username: 'alice', fullName: 'Alice', role: 'DealerUser', dealerId: 'D1', branch: null, branchId: null, ...overrides };
}

describe('parseMaintenanceHistoryFilterFromSearchParams', () => {
  it('lets SuperAdmin/CentralAdmin pass any dealerId/branchId through unchanged', () => {
    const params = new URLSearchParams({ dealerId: 'D9', branchId: 'B9' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ role: 'SuperAdmin', dealerId: null }));
    expect(filter.dealerId).toBe('D9');
    expect(filter.branchId).toBe('B9');
  });

  it('pins a non-privileged actor to their own dealer regardless of the requested dealerId', () => {
    const params = new URLSearchParams({ dealerId: 'OTHER_DEALER' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ dealerId: 'D1' }));
    expect(filter.dealerId).toBe('D1');
  });

  it('a branch-restricted (session.branch set) non-privileged actor cannot see a sibling branch via an explicit branchId', () => {
    const params = new URLSearchParams({ branchId: 'OTHER_BRANCH_SAME_DEALER' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ branch: 'สาขา A' }));
    // The real bug this closes: branchId must not pass through for a
    // branch-restricted session - branchName scoping takes over instead.
    expect(filter.branchId).toBeNull();
    expect(filter.branchName).toBe('สาขา A');
  });

  it('a dealer-wide (not branch-restricted) non-privileged actor may still narrow to one branch within their own dealer', () => {
    const params = new URLSearchParams({ branchId: 'B1' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ branch: null }));
    expect(filter.branchId).toBe('B1');
    expect(filter.branchName).toBeUndefined();
  });

  it('applies branchName session scoping only when no explicit branchId narrows it already', () => {
    const params = new URLSearchParams();
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ branch: 'สาขา A' }));
    expect(filter.branchName).toBe('สาขา A');
  });

  it('parses page/pageSize with sane defaults', () => {
    const filter = parseMaintenanceHistoryFilterFromSearchParams(new URLSearchParams(), session());
    expect(filter.page).toBe(1);
    expect(filter.pageSize).toBe(25);
  });

  it('only accepts a known sortField/sortDir, ignoring garbage values', () => {
    const params = new URLSearchParams({ sortField: 'DROP TABLE', sortDir: 'up' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session());
    expect(filter.sortField).toBeUndefined();
    expect(filter.sortDir).toBeUndefined();
  });
});
