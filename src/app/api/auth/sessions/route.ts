import { NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { findUserByUsername } from '@/lib/db';
import { listSessionsForUser } from '@/lib/authServices/sessionService';

/** Active Sessions list (spec section 5, Profile -> Security). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();
  const user = await findUserByUsername(session.username);
  if (!user) return unauthorizedError();
  const sessions = await listSessionsForUser(user.id);
  return NextResponse.json({ ok: true, sessions, currentSessionId: session.sessionId });
}
