import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchTractorsForNtr } from '@/lib/db';
import { resolveDealerScope, resolveBranchScope } from '@/lib/dealerBranchScope';

/**
 * Tractor Search for the NTR search-first workflow. Not part of
 * `NtrRepository` (scoped to `ntr_records` CRUD only) - reads `vehicles`
 * (+ a bulk `ntr_records` lookup for the "already registered" check),
 * matching the existing pattern of shared lookups living in `lib/db.ts`
 * (see `/api/pm-records/vehicle-search` for the precedent).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  // Zero-leakage: a non-privileged actor is always pinned to their own
  // dealer/branch (DealerUser additionally pinned to their own branch).
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const { branchId } = resolveBranchScope(session, dealerId, searchParams.get('branchId'));

  try {
    const results = await searchTractorsForNtr({
      dealerId,
      branchId,
      serial: searchParams.get('serial'),
      engineNumber: searchParams.get('engineNumber'),
      model: searchParams.get('model'),
    });
    return NextResponse.json({ ok: true, data: results }, { status: 200 });
  } catch (error) {
    console.error('NTR tractor search error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}
