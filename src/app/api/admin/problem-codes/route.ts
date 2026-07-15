import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listAllProblemCodesAdmin, createProblemCode } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { Severity } from '@/lib/types';

/** Failure taxonomy is a shared resource across every dealer, so management is
 *  restricted to central roles (SuperAdmin/CentralAdmin) - same gating as Dealers. */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const problemCodes = await listAllProblemCodesAdmin();
  return NextResponse.json({ ok: true, problemCodes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const label = String(body.label ?? '').trim();
    const groupName = String(body.groupName ?? '').trim();
    const system = body.system === 'powertrain' ? 'powertrain' : 'other';
    if (!label || !groupName) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกหมวดหมู่และอาการเสีย' }, { status: 400 });
    }
    const defaultSeverity: Severity | null = ['Critical', 'Major', 'Minor'].includes(body.defaultSeverity)
      ? body.defaultSeverity
      : null;
    const problemCode = await createProblemCode(
      { code: body.code ? String(body.code) : null, label, groupName, system, defaultSeverity },
      session
    );
    return NextResponse.json({ ok: true, problemCode });
  } catch (err: any) {
    console.error('create problem code error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
