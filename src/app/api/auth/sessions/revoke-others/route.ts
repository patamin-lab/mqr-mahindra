import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { revokeAllOtherSessions } from '@/lib/authServices/sessionService';

/** "Logout all other sessions" (spec section 5). */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const user = await findUserByUsername(session.username);
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  await revokeAllOtherSessions(user.id, session.sessionId, 'user_revoked_others');
  return NextResponse.json({ ok: true });
}
