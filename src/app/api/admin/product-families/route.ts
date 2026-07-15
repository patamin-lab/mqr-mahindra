import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listAllProductFamiliesAdmin, createProductFamily } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** Product Family Master is a shared resource across every dealer (a
 *  standardized product hierarchy, not dealer-specific), so management is
 *  restricted to central roles - same gating as PM Interval/problem codes. */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const productFamilies = await listAllProductFamiliesAdmin();
  return NextResponse.json({ ok: true, productFamilies });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();
    const description = body.description ? String(body.description).trim() : null;
    if (!code) return NextResponse.json({ ok: false, error: 'กรุณากรอกรหัสกลุ่มผลิตภัณฑ์' }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: 'กรุณากรอกชื่อกลุ่มผลิตภัณฑ์' }, { status: 400 });
    const productFamily = await createProductFamily({ code, name, description }, session);
    return NextResponse.json({ ok: true, productFamily });
  } catch (err: any) {
    console.error('create product family error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
