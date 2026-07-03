import { SessionUser } from '@/lib/types';
import { seesAllDealers } from '@/lib/scope';
import { MaintenanceHistoryFilter, MaintenanceHistorySortDir, MaintenanceHistorySortField } from '../types';

const SORT_FIELDS: MaintenanceHistorySortField[] = ['performed_date', 'pm_number', 'hour_meter', 'created_at'];

function numberOrNull(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Shared History Center filter parser - used by both the paginated
 * `/api/pm-records/history` route and the (unpaginated, capped) history
 * export route, so the zero-leakage dealer/branch scoping logic exists in
 * exactly one place. `page`/`pageSize` are parsed too but callers that
 * don't paginate (export) simply ignore them.
 */
export function parseMaintenanceHistoryFilterFromSearchParams(
  searchParams: URLSearchParams,
  session: SessionUser
): MaintenanceHistoryFilter {
  // Zero-leakage: a non-privileged actor is always pinned to their own
  // dealer (and, if their session carries a specific branch, their own
  // branch too - "Dealer users: only their dealer. Branch users: only
  // their branch." per spec), regardless of what the request asks for.
  const requestedDealerId = searchParams.get('dealerId');
  const dealerId = seesAllDealers(session.role) ? requestedDealerId : session.dealerId;
  const requestedBranchId = searchParams.get('branchId');
  // Fixed a real leak found in the production-stabilization audit: the
  // previous version passed `requestedBranchId` through unconditionally
  // for every role, so a branch-restricted DealerUser could see a sibling
  // branch's rows just by adding `?branchId=<other-branch>` - the
  // `branchName` fallback below only ever kicked in when branchId was
  // *absent*, never validated against an explicit one. A branch-restricted
  // session now always scopes via `branchName` regardless of what's
  // requested; a dealer-wide (not branch-restricted) non-privileged user
  // may still narrow to one branch within their own dealer, same as
  // MQR's listRecords() branch filter.
  const branchId = seesAllDealers(session.role) ? requestedBranchId : session.branch ? null : requestedBranchId;

  const sortFieldParam = searchParams.get('sortField');
  const sortField = SORT_FIELDS.includes(sortFieldParam as MaintenanceHistorySortField)
    ? (sortFieldParam as MaintenanceHistorySortField)
    : undefined;
  const sortDirParam = searchParams.get('sortDir');
  const sortDir: MaintenanceHistorySortDir | undefined = sortDirParam === 'asc' || sortDirParam === 'desc' ? sortDirParam : undefined;

  return {
    dealerId,
    branchId,
    technicianId: searchParams.get('technicianId'),
    pmIntervalId: searchParams.get('pmIntervalId'),
    pmNumber: searchParams.get('pmNumber'),
    serial: searchParams.get('serial'),
    customerName: searchParams.get('customerName'),
    customerPhone: searchParams.get('customerPhone'),
    model: searchParams.get('model'),
    hourMeterMin: numberOrNull(searchParams.get('hourMeterMin')),
    hourMeterMax: numberOrNull(searchParams.get('hourMeterMax')),
    createdBy: searchParams.get('createdBy'),
    status: searchParams.get('status'),
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    overdue: searchParams.get('overdue') === 'true',
    upcoming: searchParams.get('upcoming') === 'true',
    search: searchParams.get('search'),
    page: numberOrNull(searchParams.get('page')) ?? 1,
    pageSize: numberOrNull(searchParams.get('pageSize')) ?? 25,
    sortField,
    sortDir,
    // Branch-restricted (non-admin, no explicit branchId) users additionally
    // never see another branch's rows, using the session's own branch name
    // (SessionUser.branch) matched against the branch_name snapshot.
    branchName: !seesAllDealers(session.role) && session.branch && !branchId ? session.branch : undefined,
  };
}
