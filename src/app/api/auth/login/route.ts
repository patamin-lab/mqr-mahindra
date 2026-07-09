import { NextRequest, NextResponse } from 'next/server';
import {
  findUserByUsername,
  insertLoginLog,
  upgradePasswordHash,
  checkLockStatus,
  recordFailedLogin,
  resetFailedLogins,
  LOCKOUT_MINUTES,
} from '@/lib/db';
import { signSession, SESSION_COOKIE, SESSION_MINUTES } from '@/lib/auth';
import { SessionUser } from '@/lib/types';
import { createSession, clientIpFrom } from '@/lib/authServices/sessionService';
import { hashPassword, isPasswordExpired, verifyPassword } from '@/lib/authServices/passwordService';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { sendAccountLockedEmail } from '@/lib/email';
import { isRateLimited } from '@/lib/authServices/rateLimitService';

// Rate limiting (distinct from the per-account 5-fails/15-min lockout
// below): catches many attempts spread across many *different* usernames
// from one IP, which per-account lockout never sees. Generous enough not
// to punish a shared office/NAT IP under normal use.
const LOGIN_RATE_LIMIT_WINDOW_MINUTES = 15;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 30;

export async function POST(req: NextRequest) {
  let username = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const device = req.headers.get('user-agent') ?? '';
    const ipAddress = clientIpFrom(req);

    if (await isRateLimited(ipAddress, ['LOGIN_SUCCESS', 'LOGIN_FAILED'], LOGIN_RATE_LIMIT_WINDOW_MINUTES, LOGIN_RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json(
        { ok: false, error: 'มีการเข้าสู่ระบบผิดพลาดมากเกินไปจาก IP นี้ กรุณาลองใหม่ภายหลัง' },
        { status: 429 }
      );
    }

    const user = await findUserByUsername(username);

    // Account Lock Protection (spec section 9) - checked before touching
    // the password at all, so a locked account's attempts don't keep
    // resetting the window or leaking timing info via the hash compare.
    if (user) {
      const lock = checkLockStatus(user);
      if (lock.isLocked) {
        await insertLoginLog({ username, role: user.role, action: 'เข้าสู่ระบบ', device, result: 'fail' });
        logAuthEvent('LOGIN_FAILED', { username, userId: user.id, ipAddress, userAgent: device, metadata: { reason: 'locked' } }).catch(() => {});
        return NextResponse.json(
          { ok: false, error: `บัญชีถูกล็อกชั่วคราวเนื่องจากเข้าสู่ระบบผิดหลายครั้ง กรุณาลองใหม่ภายใน ${LOCKOUT_MINUTES} นาที หรือติดต่อผู้ดูแลระบบ` },
          { status: 423 }
        );
      }
    }

    const passwordOk = user ? await verifyPassword(password, user) : false;

    if (!user || !passwordOk || user.active === false) {
      if (user) {
        const lockResult = await recordFailedLogin(user.id, user.failed_login_attempts ?? 0);
        // Log ACCOUNT_LOCKED only on the transition into locked, not on
        // every subsequent attempt while already locked (those return
        // earlier, above, via checkLockStatus).
        if (lockResult.isLocked) {
          logAuthEvent('ACCOUNT_LOCKED', { username, userId: user.id, ipAddress, userAgent: device }).catch(() => {});
          if (user.email) sendAccountLockedEmail(user.email, LOCKOUT_MINUTES).catch(() => {});
        }
      }
      await insertLoginLog({ username, role: user?.role ?? '', action: 'เข้าสู่ระบบ', device, result: 'fail' });
      logAuthEvent('LOGIN_FAILED', { username, userId: user?.id ?? null, ipAddress, userAgent: device }).catch(() => {});
      return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // A clean login always clears any stale failed-attempt counter.
    await resetFailedLogins(user.id);

    // Opportunistic, silent upgrade of a legacy sha256 hash to salted
    // scrypt - never a forced bulk migration, just moves each account
    // over the moment it next authenticates successfully (spec section 10:
    // "Secure password hashing"). Never blocks the login on failure.
    if (user.password_algo !== 'scrypt') {
      const { hash: newHash, salt } = await hashPassword(password);
      await upgradePasswordHash(user.id, newHash, salt).catch(() => {});
    }

    // Session Platform Foundation (Authentication Platform v3.0): every
    // session gets a `user_sessions` row before the JWT is signed, so the
    // JWT only ever needs to carry the opaque lookup key - see
    // `lib/authServices/sessionService.ts`.
    const { sessionId } = await createSession(user.id, req, SESSION_MINUTES);
    const sessionUser: SessionUser = {
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      dealerId: user.dealer_id,
      branch: user.branch,
      branchId: user.branch_id ?? null,
      sessionId,
      // Password Expiration (disabled unless PASSWORD_EXPIRY_DAYS is set) -
      // an expired password forces the same Change Password gate as an
      // admin-set temporary password, not a separate mechanism.
      forcePasswordChange: !!user.force_password_change || isPasswordExpired(user.password_changed_at),
    };
    const token = await signSession(sessionUser);
    await insertLoginLog({ username: user.username, role: user.role, action: 'เข้าสู่ระบบ', device, result: 'ok' });
    logAuthEvent('LOGIN_SUCCESS', { username: user.username, userId: user.id, ipAddress, userAgent: device }).catch(() => {});

    const res = NextResponse.json({ ok: true, user: sessionUser });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MINUTES * 60,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('login error', err);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
