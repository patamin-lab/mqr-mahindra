import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listAllPmIntervalsAdmin, createPmInterval } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** PM Interval Master is a shared resource across every dealer (a
 *  standardized maintenance schedule, not dealer-specific), so management
 *  is restricted to central roles - same gating as problem codes/dealers. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const pmIntervals = await listAllPmIntervalsAdmin();
  return NextResponse.json({ ok: true, pmIntervals });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const label = String(body.label ?? '').trim();
    if (!label) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกชื่อรอบ PM' }, { status: 400 });
    }
    const intervalHours = body.intervalHours === '' || body.intervalHours == null ? null : Number(body.intervalHours);
    const intervalMonths = body.intervalMonths === '' || body.intervalMonths == null ? null : Number(body.intervalMonths);
    if (intervalHours !== null && !Number.isFinite(intervalHours)) {
      return NextResponse.json({ ok: false, error: 'ชั่วโมงต้องเป็นตัวเลข' }, { status: 400 });
    }
    if (intervalMonths !== null && !Number.isFinite(intervalMonths)) {
      return NextResponse.json({ ok: false, error: 'เดือนต้องเป็นตัวเลข' }, { status: 400 });
    }
    const pmInterval = await createPmInterval({ label, intervalHours, intervalMonths }, session);
    return NextResponse.json({ ok: true, pmInterval });
  } catch (err: any) {
    console.error('create pm interval error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
