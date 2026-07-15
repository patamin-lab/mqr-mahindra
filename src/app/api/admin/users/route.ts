import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession, sha256Hex } from '@/lib/auth';
import { listAllUsersAdmin, createUserAdmin, findUserByUsername, getLatestEmailOutcomesForUsers } from '@/lib/db';
import { canInviteUsers, canManageUsers, assignableRoles } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { Role } from '@/lib/types';
import { generateInvitationToken, unusablePlaceholderPasswordHash } from '@/lib/authServices/invitationService';
import { sendInvitationEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { ensureCompletion } from '@/lib/authServices/reliability';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageUsers(session.role)) {
    return forbiddenError();
  }
  const { searchParams } = new URL(req.url);
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const users = await listAllUsersAdmin(dealerId);

  // User Email Completeness (Authentication Platform v3.0.1, Issue 5) -
  // computed, read-only fields; batched into one extra query rather than
  // one per user.
  const emailOutcomes = await getLatestEmailOutcomesForUsers(users.map((u) => u.id));
  const usersWithEmailStatus = users.map((u) => ({
    ...u,
    emailMissing: !u.email,
    forgotPasswordAvailable: !!u.email && u.active !== false,
    emailVerified: emailOutcomes.has(u.id) ? (emailOutcomes.get(u.id) as boolean) : null,
  }));

  return NextResponse.json({ ok: true, users: usersWithEmailStatus, assignableRoles: assignableRoles(session.role) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageUsers(session.role)) {
    return forbiddenError();
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
      // v3.0.1: awaited, not fire-and-forget - guarantees the send and its
      // audit record both complete before the response is returned.
      await ensureCompletion(sendInvitationEmail(email!, fullName, inviteUrl, user.id), {
        task: 'sendInvitationEmail',
        userId: user.id,
      });
      await ensureCompletion(
        logAuthEvent('USER_INVITED', { username: user.username, userId: user.id, metadata: { invitedBy: session.username } }),
        { task: 'logAuthEvent:USER_INVITED', userId: user.id }
      );
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error('create user error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
