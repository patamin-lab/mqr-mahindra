import { NextRequest, NextResponse } from 'next/server';
import { getSession, sha256Hex } from '@/lib/auth';
import { listAllUsersAdmin, createUserAdmin, findUserByUsername } from '@/lib/db';
import { canManageUsers, assignableRoles } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { Role } from '@/lib/types';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const users = await listAllUsersAdmin(dealerId);
  return NextResponse.json({ ok: true, users, assignableRoles: assignableRoles(session.role) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const username = String(body.username ?? '').trim();
    const fullName = String(body.full_name ?? '').trim();
    const password = String(body.password ?? '');
    const role = String(body.role ?? '') as Role;

    if (!username || !fullName || !password || !role) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }
    if (!assignableRoles(session.role).includes(role)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์กำหนดบทบาทนี้' }, { status: 403 });
    }
    const existing = await findUserByUsername(username);
    if (existing) {
      return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, { status: 409 });
    }

    // Dealer Admin may only create users inside their own dealer.
    const { dealerId } = resolveDealerScope(session, body.dealer_id ?? null);

    const user = await createUserAdmin(
      {
        username,
        passwordHash: await sha256Hex(password),
        fullName,
        email: body.email ?? null,
        mobile: body.mobile ?? null,
        role,
        dealerId,
        branch: body.branch ?? null,
      },
      session
    );
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error('create user error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
