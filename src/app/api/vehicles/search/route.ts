import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchVehicles } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const dealerId = seesAllDealers(session.role) ? null : session.dealerId;

  try {
    const results = await searchVehicles(q, dealerId);
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('vehicle search error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'ค้นหาไม่สำเร็จ' }, { status: 500 });
  }
}
