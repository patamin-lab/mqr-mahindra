import { NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { canManageEmailHealth } from '@/lib/scope';
import { getEmailHealth } from '@/lib/authServices/emailHealthService';

/** Email Health (Authentication Platform v3.0.1, Issue 3). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageEmailHealth(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const health = await getEmailHealth();
  return NextResponse.json({ ok: true, health });
}
