import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { MaintenanceHistoryFilter, MaintenanceHistorySortDir, MaintenanceHistorySortField } from '@/features/maintenance/types';

const SORT_FIELDS: MaintenanceHistorySortField[] = ['performed_date', 'pm_number', 'hour_meter', 'created_at'];

function numberOrNull(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * History Center's server-side, paginated, filtered, searchable query
 * (Phase 4a). Never returns the full table - always paginated - per the
 * "must scale to 100,000+ records, no client-side full dataset" spec.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Zero-leakage: a non-privileged actor is always pinned to their own
  // dealer (and, if their session carries a specific branch, their own
  // branch too - "Dealer users: only their dealer. Branch users: only
  // their branch." per spec), regardless of what the request asks for.
  const requestedDealerId = searchParams.get('dealerId');
  const dealerId = seesAllDealers(session.role) ? requestedDealerId : session.dealerId;
  const requestedBranchId = searchParams.get('branchId');
  const branchId = seesAllDealers(session.role) ? requestedBranchId : requestedBranchId;

  const sortFieldParam = searchParams.get('sortField');
  const sortField = SORT_FIELDS.includes(sortFieldParam as MaintenanceHistorySortField)
    ? (sortFieldParam as MaintenanceHistorySortField)
    : undefined;
  const sortDirParam = searchParams.get('sortDir');
  const sortDir: MaintenanceHistorySortDir | undefined = sortDirParam === 'asc' || sortDirParam === 'desc' ? sortDirParam : undefined;

  const filter: MaintenanceHistoryFilter = {
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

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const result = await service.listHistory(filter);
    return NextResponse.json({ ok: true, data: result.data, total: result.total }, { status: 200 });
  } catch (error) {
    console.error('PM Record history API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}
