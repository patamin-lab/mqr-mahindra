import { NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { revokeAllOtherSessions } from '@/lib/authServices/sessionService';

/** "Logout all other sessions" (spec section 5). */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  const user = await findUserByUsername(session.username);
  if (!user) return unauthorizedError();

  await revokeAllOtherSessions(user.id, session.sessionId, 'user_revoked_others');
  return NextResponse.json({ ok: true });
}
