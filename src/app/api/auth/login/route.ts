import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, insertLoginLog } from '@/lib/db';
import { sha256Hex, signSession, SESSION_COOKIE, SESSION_MINUTES } from '@/lib/auth';
import { SessionUser } from '@/lib/types';
import { createSession } from '@/lib/authServices/sessionService';

export async function POST(req: NextRequest) {
  let username = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const device = req.headers.get('user-agent') ?? '';

    const user = await findUserByUsername(username);
    const hash = await sha256Hex(password);

    if (!user || user.password_hash !== hash || user.active === false) {
      await insertLoginLog({ username, role: user?.role ?? '', action: 'เข้าสู่ระบบ', device, result: 'fail' });
      return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
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
      forcePasswordChange: !!user.force_password_change,
    };
    const token = await signSession(sessionUser);
    await insertLoginLog({ username: user.username, role: user.role, action: 'เข้าสู่ระบบ', device, result: 'ok' });

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
