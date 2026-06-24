import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listBranches } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

/** Active-branch lookup for the report form's cascading dropdown (not an admin route). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get('dealerId');
  const dealerId = seesAllDealers(session.role) ? requested : session.dealerId;

  const branches = await listBranches(dealerId);
  return NextResponse.json({ ok: true, branches });
}
