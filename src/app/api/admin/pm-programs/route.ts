import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listAllPmProgramsAdmin, listDistinctVehicleModels, listAllPmIntervalsAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** PM Program is a shared resource across every dealer (a standardized
 *  model-to-interval mapping, not dealer-specific), so management is
 *  restricted to central roles - same gating as PM Interval/problem codes. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const [pmPrograms, models, pmIntervals] = await Promise.all([
    listAllPmProgramsAdmin(),
    listDistinctVehicleModels(),
    listAllPmIntervalsAdmin(),
  ]);
  return NextResponse.json({ ok: true, pmPrograms, models, pmIntervals });
}
