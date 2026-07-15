import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listAllDealersAdmin, createDealer } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return forbiddenError();
  }
  const dealers = await listAllDealersAdmin();
  return NextResponse.json({ ok: true, dealers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return forbiddenError();
  }
  try {
    const body = await req.json();
    const id = String(body.id ?? '').trim().toUpperCase();
    const shortName = String(body.short_name ?? '').trim();
    const fullName = String(body.full_name ?? '').trim();
    if (!id || !shortName || !fullName) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกรหัส, ชื่อย่อ และชื่อเต็มของดีลเลอร์' }, { status: 400 });
    }
    const dealer = await createDealer(
      { id, short_name: shortName, full_name: fullName, address: body.address ?? null },
      session
    );
    return NextResponse.json({ ok: true, dealer });
  } catch (err: any) {
    console.error('create dealer error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
