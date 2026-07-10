import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { insertLoginLog } from '@/lib/db';
import { revokeSession } from '@/lib/authServices/sessionService';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    await insertLoginLog({
      username: session.username,
      role: session.role,
      action: 'ออกจากระบบ',
      device: req.headers.get('user-agent') ?? '',
      result: 'ok',
    });
    // Revoke the server-side session row too - not strictly required for
    // *this* browser (the cookie is being cleared below either way), but
    // without it the session would still show as "active" on the Active
    // Sessions list until it naturally expires.
    await revokeSession(session.sessionId, 'user_logout').catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
