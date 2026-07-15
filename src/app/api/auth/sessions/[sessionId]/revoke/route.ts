import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { getSessionByOwnerAndId, revokeSession } from '@/lib/authServices/sessionService';

/** "Logout this session" / "Logout selected session" (spec section 5) -
 *  the same action either way; the client decides whether to also clear
 *  its own cookie based on whether `sessionId` matched its own. Ownership
 *  is checked (`getSessionByOwnerAndId`) before revoking - a client could
 *  otherwise pass any session_id UUID it guessed. */
export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  const user = await findUserByUsername(session.username);
  if (!user) return unauthorizedError();

  const target = await getSessionByOwnerAndId(user.id, params.sessionId);
  if (!target) return NextResponse.json({ ok: false, error: 'ไม่พบเซสชันนี้' }, { status: 404 });

  await revokeSession(params.sessionId, 'user_revoked');
  return NextResponse.json({ ok: true, wasCurrent: params.sessionId === session.sessionId });
}
