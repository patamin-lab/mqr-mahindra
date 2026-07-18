import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { updateProblemCode } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { Severity } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return forbiddenError();
  }
  try {
    const body = await req.json();
    const defaultSeverity: Severity | null | undefined =
      body.defaultSeverity === undefined
        ? undefined
        : ['Critical', 'Major', 'Minor'].includes(body.defaultSeverity)
          ? body.defaultSeverity
          : null;
    const problemCode = await updateProblemCode(
      params.id,
      {
        code: body.code,
        label: body.label,
        groupName: body.groupName,
        system: body.system,
        defaultSeverity,
        active: body.active,
      },
      session
    );
    return NextResponse.json({ ok: true, problemCode });
  } catch (err: any) {
    // PGRST116 = PostgREST's "no rows returned" from `.single()` - a
    // non-existent id, not a server error (production regression audit,
    // 2026-07-18: this previously fell through to a generic 500).
    if (err?.code === 'PGRST116') {
      return NextResponse.json({ ok: false, error: 'ไม่พบรหัสปัญหานี้' }, { status: 404 });
    }
    console.error('update problem code error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
