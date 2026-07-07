import { SessionUser } from '@/lib/types';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
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
  // Dealer/Branch Scope Platform Standard: `dealerId`/`branchId` below are
  // only ever a *narrowing* request for a privileged role - the real
  // DealerUser pin (dealer AND branch) is enforced downstream by
  // `applyScope()`/`resolveBranchScope()` inside the repository, whenever
  // the caller passes `session` into `listHistory()` (every caller now
  // does). This replaces the previous hand-rolled `branchName`-based pin
  // (matching the legacy free-text `session.branch` display string
  // against the `branch_name` snapshot column), which is no longer needed
  // now that a real `branch_id` UUID (`session.branchId`) exists.
  const requestedDealerId = searchParams.get('dealerId');
  const { dealerId } = resolveDealerScope(session, requestedDealerId);
  const branchId = searchParams.get('branchId');

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
    // No longer derived from session - `applyScope()`'s real `branch_id`
    // pin (see the comment above) replaces the old `branch_name`
    // text-snapshot matching for DealerUser scoping. `branchName` remains
    // in the filter shape only for any caller that explicitly wants to
    // filter by the free-text snapshot name itself (not currently used by
    // any UI, kept for interface back-compat).
    branchName: undefined,
  };
}
