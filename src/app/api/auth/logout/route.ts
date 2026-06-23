import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { insertLoginLog } from '@/lib/db';

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
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
