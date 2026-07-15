import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { updateProblemCode } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { Severity } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
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
    console.error('update problem code error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
