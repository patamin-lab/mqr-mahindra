import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'mqr_session';

// Pages/routes reachable with NO session at all - the entry points into the
// password-reset/invitation flows (Authentication Platform v3.0), plus the
// pre-existing login page/route.
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/accept-invitation',
];
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/accept-invitation',
];

// Reachable while `forcePasswordChange` is true, so a user forced into a
// password change isn't also locked out of logging out.
const FORCE_CHANGE_ALLOWED_PATHS = ['/change-password'];
const FORCE_CHANGE_ALLOWED_API_PREFIXES = ['/api/auth/change-password', '/api/auth/logout'];

interface DecodedSession {
  sessionId?: string;
  forcePasswordChange?: boolean;
}

async function verifyToken(token: string | undefined): Promise<DecodedSession | null> {
  if (!token) return null;
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as DecodedSession;
  } catch {
    return null;
  }
}

/** Session Platform Foundation (Authentication Platform v3.0): a valid JWT
 *  signature is no longer sufficient - the `user_sessions` row it points
 *  to must also still be un-revoked and unexpired, so "logout this
 *  session"/"logout all other devices"/an admin's "force logout all
 *  sessions" all take effect on the *very next* request, not merely on
 *  next login. A plain REST fetch (not `@supabase/supabase-js`) is used
 *  deliberately - this file runs on the Edge runtime, same reason it
 *  already reimplements its own `jwtVerify` call instead of importing
 *  `lib/auth.ts` (which pulls in `next/headers`, unavailable here). */
async function isSessionRevokedOrExpired(sessionId: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  try {
    const res = await fetch(
      `${url}/rest/v1/user_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=revoked_at,expires_at&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    );
    if (!res.ok) return true;
    const rows: { revoked_at: string | null; expires_at: string }[] = await res.json();
    const row = rows[0];
    if (!row) return true;
    if (row.revoked_at) return true;
    if (new Date(row.expires_at).getTime() <= Date.now()) return true;
    return false;
  } catch {
    // Fail closed on a lookup error - an unreachable session store should
    // never be silently treated as "session is fine."
    return true;
  }
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const decoded = await verifyToken(token);
  const valid = !!decoded?.sessionId && !(await isSessionRevokedOrExpired(decoded.sessionId));

  if (PUBLIC_PATHS.includes(pathname)) {
    if (valid) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // First Login Password Change / admin-forced reset: block everything
  // except the Change Password page/route and logout until it succeeds.
  if (decoded!.forcePasswordChange) {
    const allowed =
      FORCE_CHANGE_ALLOWED_PATHS.includes(pathname) || matchesPrefix(pathname, FORCE_CHANGE_ALLOWED_API_PREFIXES);
    if (!allowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, error: 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/change-password', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
