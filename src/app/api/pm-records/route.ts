import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * PM Record collection route — structure only (Sprint 10.1).
 *
 * Checks for an authenticated session (same as every other API route) and
 * otherwise returns 501. No RBAC scoping, no validation, no repository/
 * service call yet - CRUD is out of scope for this sprint.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented' }, { status: 501 });
}

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented' }, { status: 501 });
}
