import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'mqr_session';

async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = await isValidToken(token);

  if (pathname === '/login') {
    if (valid) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
