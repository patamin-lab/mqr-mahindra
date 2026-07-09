import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsernameOrEmail } from '@/lib/db';
import { generateResetToken } from '@/lib/authServices/passwordResetService';
import { sendPasswordResetEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { clientIpFrom } from '@/lib/authServices/sessionService';
import { isRateLimited } from '@/lib/authServices/rateLimitService';

/** Forgot Password (spec section 2) - "User enters Username or Email" and
 *  the response is *always* the exact same generic message, regardless of
 *  whether the account exists, whether it has an email on file, or
 *  whether something failed internally - "Never reveal whether the
 *  account exists" is the entire point of this route. */
const GENERIC_MESSAGE = 'หากมีบัญชีนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลที่ลงทะเบียนไว้แล้ว';

// Rate limiting: caps how often one IP can trigger this route regardless
// of outcome - protects against email-bombing a real account's inbox or
// scripted enumeration attempts. The event is logged unconditionally
// (below), including for an identifier that matches no account, so this
// count actually reflects total request volume, not just "found" hits -
// otherwise an attacker targeting nonexistent accounts would never be
// counted at all.
const RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES = 60;
const RESET_REQUEST_RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const ipAddress = clientIpFrom(req);
  try {
    if (await isRateLimited(ipAddress, ['PASSWORD_RESET_REQUEST'], RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES, RESET_REQUEST_RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ ok: false, error: 'มีการร้องขอมากเกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429 });
    }

    const body = await req.json();
    const identifier = String(body.identifier ?? '').trim();
    if (identifier) {
      const user = await findUserByUsernameOrEmail(identifier);
      const eligible = !!(user && user.email && user.active !== false);
      if (eligible) {
        const token = await generateResetToken(user.id);
        const baseUrl = new URL(req.url).origin;
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
      }
      // Logged unconditionally (found or not) so rate limiting actually
      // sees every request - the response itself never reveals which
      // branch ran.
      logAuthEvent('PASSWORD_RESET_REQUEST', {
        username: user?.username ?? null,
        userId: user?.id ?? null,
        ipAddress,
        metadata: { eligible },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (err) {
    // Still the generic success shape - an internal error must never
    // become a different, distinguishable response than "not found."
    console.error('forgot-password error', err);
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}
