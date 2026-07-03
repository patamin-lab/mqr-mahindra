import { SessionUser } from '@/lib/types';
import { seesAllDealers } from '@/lib/scope';
import { NtrHistoryFilter } from '../types';

const SORT_FIELDS: NtrHistoryFilter['sortField'][] = ['created_at', 'retail_date', 'ntr_number'];

/**
 * Shared Tractor Registry filter parser - used by both the paginated
 * `/api/ntr-records/history` route and the (unpaginated, capped) Excel
 * export route, so the zero-leakage dealer-scoping logic exists in exactly
 * one place (the class of bug this guards against: PM's history/export
 * split once let a branch filter bypass scope because only one of the two
 * routes enforced it - see docs/standards/SECURITY_STANDARD.md).
 */
export function parseNtrHistoryFilterFromSearchParams(searchParams: URLSearchParams, session: SessionUser): NtrHistoryFilter {
  const requestedDealerId = searchParams.get('dealerId');
  const dealerId = seesAllDealers(session.role) ? requestedDealerId : session.dealerId;
  const branchId = searchParams.get('branchId');

  const sortFieldParam = searchParams.get('sortField');
  const sortField = (SORT_FIELDS as (string | null)[]).includes(sortFieldParam)
    ? (sortFieldParam as NtrHistoryFilter['sortField'])
    : undefined;
  const sortDirParam = searchParams.get('sortDir');
  const sortDir: NtrHistoryFilter['sortDir'] = sortDirParam === 'asc' || sortDirParam === 'desc' ? sortDirParam : undefined;

  const warrantyStatusParam = searchParams.get('warrantyStatus');
  const warrantyStatus =
    warrantyStatusParam === 'in_warranty' || warrantyStatusParam === 'out_of_warranty' ? warrantyStatusParam : undefined;

  return {
    dealerId,
    branchId,
    model: searchParams.get('model') ?? undefined,
    province: searchParams.get('province') ?? undefined,
    district: searchParams.get('district') ?? undefined,
    retailDateFrom: searchParams.get('retailDateFrom') ?? undefined,
    retailDateTo: searchParams.get('retailDateTo') ?? undefined,
    warrantyStatus,
    customerName: searchParams.get('customerName') ?? undefined,
    serial: searchParams.get('serial') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    pageSize: Number(searchParams.get('pageSize') ?? '25') || 25,
    sortField,
    sortDir,
  };
}
