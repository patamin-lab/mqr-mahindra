import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db';
import { validateResetToken, consumeResetToken } from '@/lib/authServices/passwordResetService';
import {
  applyNewPassword,
  hashPassword,
  isPasswordReused,
  recordPasswordHistory,
  validateComplexity,
} from '@/lib/authServices/passwordService';
import { revokeAllSessions } from '@/lib/authServices/sessionService';
import { sendPasswordChangedEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';

const TOKEN_ERROR_MESSAGES: Record<NonNullable<Awaited<ReturnType<typeof validateResetToken>>['reason']>, string> = {
  not_found: 'ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่',
  expired: 'ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  used: 'ลิงก์นี้ถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่',
};

/** After success: invalidate token, redirect to Login (spec section 3) -
 *  the redirect itself is the client's job (`reset-password-form.tsx`);
 *  this route just reports success and does the invalidation. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token ?? '');
    const newPassword = String(body.newPassword ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');

    if (!token) return NextResponse.json({ ok: false, error: 'ลิงก์ไม่ถูกต้อง' }, { status: 400 });
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' }, { status: 400 });
    }
    const complexityError = validateComplexity(newPassword);
    if (complexityError) return NextResponse.json({ ok: false, error: complexityError }, { status: 400 });

    const validation = await validateResetToken(token);
    if (!validation.valid || !validation.userId) {
      const message = validation.reason ? TOKEN_ERROR_MESSAGES[validation.reason] : TOKEN_ERROR_MESSAGES.not_found;
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (await isPasswordReused(validation.userId, newPassword)) {
      return NextResponse.json({ ok: false, error: 'ห้ามใช้ซ้ำกับรหัสผ่าน 5 รายการล่าสุด' }, { status: 400 });
    }

    const user = await getUserById(validation.userId);
    if (!user) return NextResponse.json({ ok: false, error: 'ไม่พบบัญชีผู้ใช้นี้' }, { status: 404 });

    const { hash, salt } = await hashPassword(newPassword);
    await applyNewPassword(validation.userId, hash, salt, { clearForcePasswordChange: true });
    await recordPasswordHistory(validation.userId, hash, salt);
    await consumeResetToken(token);

    // A password reset is a strong enough signal to treat every existing
    // session as compromised-by-default, unlike a voluntary change (which
    // only offers an opt-in "logout other devices" checkbox).
    await revokeAllSessions(validation.userId, 'password_reset').catch(() => {});

    if (user.email) sendPasswordChangedEmail(user.email).catch(() => {});
    logAuthEvent('PASSWORD_RESET_SUCCESS', { username: user.username, userId: user.id }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('reset-password error', err);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
