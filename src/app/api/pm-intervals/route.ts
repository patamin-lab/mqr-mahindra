import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listActivePmIntervals } from '@/lib/db';

/** Active PM Interval Master lookup for the PM Record form's dropdown (not
 *  an admin route) - mirrors /api/technicians and /api/branches. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const pmIntervals = await listActivePmIntervals();
  return NextResponse.json({ ok: true, pmIntervals });
}
