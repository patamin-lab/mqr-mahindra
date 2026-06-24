import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listVehicles } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const dealerId = seesAllDealers(session.role) ? null : session.dealerId;

  try {
    const results = await listVehicles(dealerId);
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('vehicle list error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'โหลดรายการรถไม่สำเร็จ' }, { status: 500 });
  }
}
