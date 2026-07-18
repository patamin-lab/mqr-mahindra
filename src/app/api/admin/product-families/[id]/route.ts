import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { updateProductFamily } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return forbiddenError();
  }
  try {
    const body = await req.json();
    const productFamily = await updateProductFamily(
      params.id,
      {
        code: body.code !== undefined ? String(body.code).trim() : undefined,
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        description: body.description !== undefined ? (body.description ? String(body.description).trim() : null) : undefined,
        active: body.active,
      },
      session
    );
    return NextResponse.json({ ok: true, productFamily });
  } catch (err: any) {
    // PGRST116 = PostgREST's "no rows returned" from `.single()` - a
    // non-existent id, not a server error (production regression audit,
    // 2026-07-18: this previously fell through to a generic 500).
    if (err?.code === 'PGRST116') {
      return NextResponse.json({ ok: false, error: 'ไม่พบกลุ่มผลิตภัณฑ์นี้' }, { status: 404 });
    }
    console.error('update product family error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
