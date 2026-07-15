import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { setMaintenanceProgramFamilies, syncMaintenanceProgramVersion } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** Replaces the full set of Product Families mapped to this Maintenance
 *  Interval - matches the admin page's per-interval checkbox multi-select
 *  (the request body is simply the complete list of currently-checked
 *  Product Family ids). */
export async function PUT(req: NextRequest, { params }: { params: { pmIntervalId: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const productFamilyIds = Array.isArray(body.productFamilyIds) ? body.productFamilyIds.map((f: unknown) => String(f)) : [];
    const affectedFamilyIds = await setMaintenanceProgramFamilies(params.pmIntervalId, productFamilyIds, session);
    // Maintenance history must never be recalculated against today's live
    // program definition - every family whose resolved stage list actually
    // changed gets a new immutable version snapshot, vehicles already
    // pinned to an older version are unaffected.
    for (const familyId of affectedFamilyIds) {
      await syncMaintenanceProgramVersion(familyId, session);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('set maintenance program families error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
