import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { canManageEmailHealth } from '@/lib/scope';
import { sendTestEmail } from '@/lib/email';

/** Admin Test Email (Authentication Platform v3.0.1, Issue 4) - sends a
 *  real email through the exact same path every auth email uses, so a
 *  successful test is real evidence the configuration works. Defaults to
 *  the requesting admin's own registered email if `to` isn't supplied. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageEmailHealth(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const user = await findUserByUsername(session.username);
  const to = String(body.to ?? user?.email ?? '').trim();
  if (!to) {
    return NextResponse.json({ ok: false, error: 'ไม่มีอีเมลปลายทาง กรุณาระบุอีเมลที่ต้องการทดสอบ' }, { status: 400 });
  }

  const result = await sendTestEmail(to, user?.id);
  return NextResponse.json({ ok: result.ok, result });
}
