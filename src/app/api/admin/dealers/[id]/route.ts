import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { updateDealer } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const dealer = await updateDealer(
      params.id,
      {
        short_name: body.short_name,
        full_name: body.full_name,
        address: body.address,
        active: body.active,
      },
      session
    );
    return NextResponse.json({ ok: true, dealer });
  } catch (err: any) {
    console.error('update dealer error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
