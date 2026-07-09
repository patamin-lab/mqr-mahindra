import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { revokeAllSessions } from '@/lib/authServices/sessionService';

/** "Logout all sessions" (spec section 5) - includes the caller's own
 *  current session; the client must also clear its cookie afterward
 *  (`ActiveSessionsSection.tsx` does this by calling the regular logout
 *  route right after this succeeds). */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const user = await findUserByUsername(session.username);
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  await revokeAllSessions(user.id, 'user_revoked_all');
  return NextResponse.json({ ok: true });
}
