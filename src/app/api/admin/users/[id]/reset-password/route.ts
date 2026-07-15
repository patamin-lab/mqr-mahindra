import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession, sha256Hex } from '@/lib/auth';
import { getUserById, resetUserPassword } from '@/lib/db';
import { canManageUsers, canManageRoleTarget } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const target = await getUserById(params.id);
    if (!target) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
    if (!canManageRoleTarget(session.role, target.role)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์รีเซ็ตรหัสผ่านผู้ใช้นี้' }, { status: 403 });
    }
    if (!canAccessDealerBranch(session, target.dealer_id ?? '', null)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์รีเซ็ตรหัสผ่านผู้ใช้นี้' }, { status: 403 });
    }
    const body = await req.json();
    const newPassword = String(body.newPassword ?? '');
    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
    }
    await resetUserPassword(params.id, await sha256Hex(newPassword), session);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('reset password error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
