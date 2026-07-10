import { NextRequest, NextResponse } from 'next/server';
import { getSession, sha256Hex } from '@/lib/auth';
import { listAllUsersAdmin, createUserAdmin, findUserByUsername } from '@/lib/db';
import { canInviteUsers, canManageUsers, assignableRoles } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { Role } from '@/lib/types';
import { generateInvitationToken, unusablePlaceholderPasswordHash } from '@/lib/authServices/invitationService';
import { sendInvitationEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';

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
    const email = body.email ? String(body.email).trim() : null;
    // User Invitation (spec section 8) - the admin creates the account
    // without ever knowing its permanent password. Mutually exclusive
    // with the existing "set a temporary password directly" mode
    // (section 7): exactly one of `invite`/`password` applies per user.
    const invite = !!body.invite;

    if (!username || !fullName || !role || (invite ? !email : !password)) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }
    if (invite && !canInviteUsers(session.role)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เชิญผู้ใช้' }, { status: 403 });
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

    // A temp password is hashed the same legacy (unsalted sha256) way
    // admin-set passwords always have been - `password_algo` defaults to
    // 'sha256' on insert, and the login route's existing opportunistic
    // upgrade-to-scrypt already runs on this user's very first login, so
    // it's never left in the weaker format for its whole life. (Storing a
    // scrypt hash here directly would require also carrying its salt
    // through createUserAdmin's insert, which nothing else needs yet.)
    const passwordHash = invite ? unusablePlaceholderPasswordHash() : await sha256Hex(password);

    const user = await createUserAdmin(
      {
        username,
        passwordHash,
        fullName,
        email,
        mobile: body.mobile ?? null,
        role,
        dealerId,
        branch: body.branch ?? null,
        active: !invite,
        forcePasswordChange: !invite,
      },
      session
    );

    if (invite) {
      const token = await generateInvitationToken(user.id, session.username);
      const baseUrl = new URL(req.url).origin;
      const inviteUrl = `${baseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
      sendInvitationEmail(email!, fullName, inviteUrl).catch(() => {});
      logAuthEvent('USER_INVITED', { username: user.username, userId: user.id, metadata: { invitedBy: session.username } }).catch(() => {});
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error('create user error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
