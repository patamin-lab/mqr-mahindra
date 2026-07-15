import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession, signSession, SESSION_COOKIE, SESSION_MINUTES } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import {
  applyNewPassword,
  hashPassword,
  isPasswordReused,
  isWithinMinimumAge,
  recordPasswordHistory,
  validateComplexity,
  verifyPassword,
} from '@/lib/authServices/passwordService';
import { revokeAllOtherSessions, clientIpFrom } from '@/lib/authServices/sessionService';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { ensureCompletion } from '@/lib/authServices/reliability';
import { SessionUser } from '@/lib/types';

/** Self-service Change Password (spec section 4) and the same route the
 *  First Login Password Change (section 7) forced redirect posts to -
 *  one implementation for both, since an admin-set temporary password is
 *  still a password the user knows and can supply as "current". */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const body = await req.json();
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  const confirmPassword = String(body.confirmPassword ?? '');
  const logoutOtherDevices = !!body.logoutOtherDevices;

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ ok: false, error: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' }, { status: 400 });
  }
  const complexityError = validateComplexity(newPassword);
  if (complexityError) {
    return NextResponse.json({ ok: false, error: complexityError }, { status: 400 });
  }

  const user = await findUserByUsername(session.username);
  if (!user) return unauthorizedError();

  const currentOk = await verifyPassword(currentPassword, user);
  if (!currentOk) {
    return NextResponse.json({ ok: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
  }

  if (await isPasswordReused(user.id, newPassword)) {
    return NextResponse.json({ ok: false, error: 'ห้ามใช้ซ้ำกับรหัสผ่าน 5 รายการล่าสุด' }, { status: 400 });
  }

  // Minimum Password Age (disabled unless PASSWORD_MIN_AGE_HOURS is set) -
  // never applies to a mandatory change (First Login / an expired
  // password already forced this route), only a voluntary one.
  if (!session.forcePasswordChange && isWithinMinimumAge(user.password_changed_at)) {
    return NextResponse.json({ ok: false, error: 'ยังไม่ถึงระยะเวลาขั้นต่ำก่อนเปลี่ยนรหัสผ่านอีกครั้ง' }, { status: 400 });
  }

  const wasForced = session.forcePasswordChange;
  const { hash, salt } = await hashPassword(newPassword);
  await applyNewPassword(user.id, hash, salt, { clearForcePasswordChange: true });
  await recordPasswordHistory(user.id, hash, salt);
  await ensureCompletion(
    logAuthEvent(wasForced ? 'FORCE_PASSWORD_CHANGE_COMPLETED' : 'PASSWORD_CHANGED', {
      username: user.username,
      userId: user.id,
      ipAddress: clientIpFrom(req),
      userAgent: req.headers.get('user-agent'),
    }),
    { task: 'logAuthEvent:PASSWORD_CHANGED', userId: user.id }
  );

  if (logoutOtherDevices) {
    await revokeAllOtherSessions(user.id, session.sessionId, 'password_changed');
  }

  // Re-sign the *same* session (same sessionId - no new user_sessions row,
  // nothing orphaned) with forcePasswordChange flipped to false. That
  // claim is read straight off the JWT by middleware.ts, so without this
  // the user would stay blocked on /change-password until their token
  // naturally expired.
  const refreshedSession: SessionUser = { ...session, forcePasswordChange: false };
  const token = await signSession(refreshedSession);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MINUTES * 60,
    path: '/',
  });
  return res;
}
