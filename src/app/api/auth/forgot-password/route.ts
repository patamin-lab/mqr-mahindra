import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsernameOrEmail } from '@/lib/db';
import { generateResetToken } from '@/lib/authServices/passwordResetService';
import { sendPasswordResetEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { clientIpFrom } from '@/lib/authServices/sessionService';
import { isRateLimited } from '@/lib/authServices/rateLimitService';
import { ensureCompletion } from '@/lib/authServices/reliability';

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

/**
 * v3.0.1 reliability patch. The previous version called
 * `sendPasswordResetEmail(...).catch(() => {})` and
 * `logAuthEvent(...).catch(() => {})` without awaiting either - a
 * production incident proved this loses work silently: Vercel can freeze
 * a serverless function's execution the instant the response is sent,
 * and neither call is guaranteed to run to completion before that
 * happens. Both are now awaited (through `ensureCompletion`, which never
 * throws and never changes the response). The response text, status
 * codes, and anti-enumeration behavior are all unchanged.
 */
export async function POST(req: NextRequest) {
  const ipAddress = clientIpFrom(req);
  try {
    if (
      await isRateLimited(ipAddress, ['PASSWORD_RESET_REQUEST'], RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES, RESET_REQUEST_RATE_LIMIT_MAX_ATTEMPTS)
    ) {
      return NextResponse.json({ ok: false, error: 'มีการร้องขอมากเกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429 });
    }

    const body = await req.json();
    const identifier = String(body.identifier ?? '').trim();
    const user = identifier ? await findUserByUsernameOrEmail(identifier) : null;
    const eligible = !!(user && user.email && user.active !== false);

    if (eligible) {
      const token = await generateResetToken(user.id);
      const baseUrl = new URL(req.url).origin;
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await ensureCompletion(sendPasswordResetEmail(user.email, resetUrl, user.id), {
        task: 'sendPasswordResetEmail',
        userId: user.id,
      });
    }

    // Issue 6: audit logging is mandatory for every Forgot Password
    // request that reaches this point - awaited, not fire-and-forget, so
    // there is exactly one record per request, never a silent loss.
    await ensureCompletion(
      logAuthEvent('PASSWORD_RESET_REQUEST', {
        username: user?.username ?? null,
        userId: user?.id ?? null,
        ipAddress,
        metadata: { eligible },
      }),
      { task: 'logAuthEvent:PASSWORD_RESET_REQUEST', ipAddress }
    );

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (err) {
    // Still the generic success shape - an internal error must never
    // become a different, distinguishable response than "not found." But
    // the attempt itself must still be audited (Issue 6) - the previous
    // version returned success here without ever logging anything.
    console.error('forgot-password error', err);
    await ensureCompletion(
      logAuthEvent('PASSWORD_RESET_REQUEST', { ipAddress, metadata: { eligible: false, error: true } }),
      { task: 'logAuthEvent:PASSWORD_RESET_REQUEST:error', ipAddress }
    );
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}
