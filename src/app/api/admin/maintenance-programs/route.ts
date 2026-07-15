import { NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listAllMaintenanceProgramAssignmentsAdmin, listActiveProductFamilies, listAllPmIntervalsAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** Maintenance Program Assignment is a shared resource across every dealer
 *  (a standardized Product Family-to-interval mapping, not dealer-specific),
 *  so management is restricted to central roles - same gating as PM
 *  Interval/Product Family/problem codes. Replaces the old model-based
 *  PM Program admin screen. */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [assignments, productFamilies, pmIntervals] = await Promise.all([
    listAllMaintenanceProgramAssignmentsAdmin(),
    listActiveProductFamilies(),
    listAllPmIntervalsAdmin(),
  ]);
  return NextResponse.json({ ok: true, assignments, productFamilies, pmIntervals });
}
