import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchVehiclesForPm } from '@/lib/db';
import { resolveDealerScope, resolveBranchScope } from '@/lib/dealerBranchScope';
import { unauthorizedError } from '@/lib/apiError';

/**
 * Server-side Tractor Master search for the Maintenance search-first
 * workflow. Not part of MaintenanceRepository (which is scoped to
 * `pm_records` CRUD only) - this reads `vehicles` + `pm_records` history, matching the
 * existing pattern of shared lookups living in `lib/db.ts` alongside
 * technicians/branches, not inside a module-specific repository.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  const { searchParams } = new URL(req.url);
  // Zero-leakage: a non-privileged actor is always pinned to their own
  // dealer/branch (DealerUser additionally pinned to their own branch).
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const { branchId } = resolveBranchScope(session, dealerId, searchParams.get('branchId'));

  try {
    const results = await searchVehiclesForPm({
      dealerId,
      branchId,
      serial: searchParams.get('serial'),
      customerName: searchParams.get('customerName'),
      customerPhone: searchParams.get('customerPhone'),
    });
    return NextResponse.json({ ok: true, data: results }, { status: 200 });
  } catch (error) {
    console.error('PM Record vehicle search error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}
