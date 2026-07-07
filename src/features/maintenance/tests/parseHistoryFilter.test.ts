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

  it('a DealerUser requesting a sibling branch is not blocked by the parser itself - the real pin is enforced downstream by applyScope()/resolveBranchScope() once session is passed to listHistory()', () => {
    const params = new URLSearchParams({ branchId: 'OTHER_BRANCH_SAME_DEALER' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ role: 'DealerUser', branchId: 'B1' }));
    // The parser no longer does branch enforcement (see dealerBranchScope.test.ts /
    // applyScope.test.ts for the actual DealerUser branch-pin coverage).
    expect(filter.branchId).toBe('OTHER_BRANCH_SAME_DEALER');
    expect(filter.branchName).toBeUndefined();
  });

  it('a privileged actor may narrow to one branch within a dealer via an explicit branchId', () => {
    const params = new URLSearchParams({ branchId: 'B1' });
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ role: 'DealerAdmin', branch: null }));
    expect(filter.branchId).toBe('B1');
    expect(filter.branchName).toBeUndefined();
  });

  it('never derives branchName from the legacy free-text session.branch display string', () => {
    const params = new URLSearchParams();
    const filter = parseMaintenanceHistoryFilterFromSearchParams(params, session({ branch: 'สาขา A' }));
    expect(filter.branchName).toBeUndefined();
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
