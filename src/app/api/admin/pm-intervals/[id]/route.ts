import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { updatePmInterval, syncMaintenanceProgramVersionsForInterval } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return forbiddenError();
  }
  try {
    const body = await req.json();
    const intervalHours =
      body.intervalHours === undefined
        ? undefined
        : body.intervalHours === '' || body.intervalHours == null
          ? null
          : Number(body.intervalHours);
    const intervalMonths =
      body.intervalMonths === undefined
        ? undefined
        : body.intervalMonths === '' || body.intervalMonths == null
          ? null
          : Number(body.intervalMonths);
    if (intervalHours != null && !Number.isFinite(intervalHours)) {
      return NextResponse.json({ ok: false, error: 'ชั่วโมงต้องเป็นตัวเลข' }, { status: 400 });
    }
    if (intervalMonths != null && !Number.isFinite(intervalMonths)) {
      return NextResponse.json({ ok: false, error: 'เดือนต้องเป็นตัวเลข' }, { status: 400 });
    }
    const pmInterval = await updatePmInterval(
      params.id,
      { label: body.label, intervalHours, intervalMonths, active: body.active },
      session
    );
    // Changing this interval's own hours/months changes what every Product
    // Family currently assigned it resolves to, even though the assignment
    // table itself didn't change - re-sync their version snapshots too.
    await syncMaintenanceProgramVersionsForInterval(params.id, session);
    return NextResponse.json({ ok: true, pmInterval });
  } catch (err: any) {
    // PGRST116 = PostgREST's "no rows returned" from `.single()` - a
    // non-existent id, not a server error (production regression audit,
    // 2026-07-18: this previously fell through to a generic 500).
    if (err?.code === 'PGRST116') {
      return NextResponse.json({ ok: false, error: 'ไม่พบรอบบำรุงรักษานี้' }, { status: 404 });
    }
    console.error('update pm interval error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
