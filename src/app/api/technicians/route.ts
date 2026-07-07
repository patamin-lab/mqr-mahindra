import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listTechnicians } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';

/** Active-technician lookup for the report form's cascading dropdown (not an admin route). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const branch = searchParams.get('branch');

  const technicians = await listTechnicians(dealerId, branch);
  return NextResponse.json({ ok: true, technicians });
}
