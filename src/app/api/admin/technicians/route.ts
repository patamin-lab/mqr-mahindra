import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listAllTechniciansAdmin, createTechnician } from '@/lib/db';
import { seesAllDealers, canManageMasterData } from '@/lib/scope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canManageMasterData(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const dealerId = seesAllDealers(session.role) ? searchParams.get('dealerId') : session.dealerId;
  const technicians = await listAllTechniciansAdmin(dealerId);
  return NextResponse.json({ ok: true, technicians });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canManageMasterData(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ ok: false, error: 'กรุณากรอกชื่อช่าง' }, { status: 400 });

    const dealerId = seesAllDealers(session.role) ? String(body.dealer_id ?? '').trim() : session.dealerId;
    if (!dealerId) return NextResponse.json({ ok: false, error: 'กรุณาเลือกดีลเลอร์' }, { status: 400 });

    const technician = await createTechnician(
      { code: body.code ?? null, name, mobile: body.mobile ?? null, branch: body.branch ?? null, dealer_id: dealerId },
      session
    );
    return NextResponse.json({ ok: true, technician });
  } catch (err: any) {
    console.error('create technician error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
