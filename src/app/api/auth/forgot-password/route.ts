import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsernameOrEmail } from '@/lib/db';
import { generateResetToken } from '@/lib/authServices/passwordResetService';
import { sendPasswordResetEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { clientIpFrom } from '@/lib/authServices/sessionService';

/** Forgot Password (spec section 2) - "User enters Username or Email" and
 *  the response is *always* the exact same generic message, regardless of
 *  whether the account exists, whether it has an email on file, or
 *  whether something failed internally - "Never reveal whether the
 *  account exists" is the entire point of this route. */
const GENERIC_MESSAGE = 'หากมีบัญชีนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลที่ลงทะเบียนไว้แล้ว';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? '').trim();
    if (identifier) {
      const user = await findUserByUsernameOrEmail(identifier);
      if (user && user.email && user.active !== false) {
        const token = await generateResetToken(user.id);
        const baseUrl = new URL(req.url).origin;
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
        logAuthEvent('PASSWORD_RESET_REQUEST', {
          username: user.username,
          userId: user.id,
          ipAddress: clientIpFrom(req),
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (err) {
    // Still the generic success shape - an internal error must never
    // become a different, distinguishable response than "not found."
    console.error('forgot-password error', err);
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}
