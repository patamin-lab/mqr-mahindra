import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, unlockUserAccount } from '@/lib/db';
import { canUnlockAccounts, canManageRoleTarget } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { logAuthEvent } from '@/lib/authServices/auditService';

/** Admin-initiated manual unlock (spec section 9) - mirrors the existing
 *  reset-password admin route's permission checks exactly. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canUnlockAccounts(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const target = await getUserById(params.id);
    if (!target) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
    if (!canManageRoleTarget(session.role, target.role)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ปลดล็อกผู้ใช้นี้' }, { status: 403 });
    }
    if (!canAccessDealerBranch(session, target.dealer_id ?? '', null)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ปลดล็อกผู้ใช้นี้' }, { status: 403 });
    }
    await unlockUserAccount(params.id, session);
    logAuthEvent('ACCOUNT_UNLOCKED', {
      username: target.username,
      userId: target.id,
      metadata: { unlockedBy: session.username },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('unlock account error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
