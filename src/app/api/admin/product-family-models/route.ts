import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listProductFamilyModelMap, listAllProductFamiliesAdmin, setProductFamilyForModel } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** Product Family <-> Model mapping - "every tractor model belongs to one
 *  Product Family" per spec (unlike Maintenance Program Assignment, which
 *  is many-to-many). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const [modelMap, productFamilies] = await Promise.all([listProductFamilyModelMap(), listAllProductFamiliesAdmin()]);
  return NextResponse.json({ ok: true, modelMap, productFamilies });
}

/** Sets (or clears, when productFamilyId is null) the single Product Family
 *  one Tractor Model belongs to. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const model = String(body.model ?? '').trim();
    if (!model) return NextResponse.json({ ok: false, error: 'model is required' }, { status: 400 });
    const productFamilyId = body.productFamilyId ? String(body.productFamilyId) : null;
    await setProductFamilyForModel(model, productFamilyId, session);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('set product family for model error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
