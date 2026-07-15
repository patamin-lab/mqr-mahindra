import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listActivePmIntervals } from '@/lib/db';

/** Active PM Interval Master lookup for the PM Record form's dropdown (not
 *  an admin route) - mirrors /api/technicians and /api/branches. Optional
 *  `?model=` narrows to only the intervals mapped to that Tractor Model
 *  via PM Program (see docs on listActivePmIntervals). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const { searchParams } = new URL(req.url);
  const model = searchParams.get('model');

  const pmIntervals = await listActivePmIntervals(model);
  return NextResponse.json({ ok: true, pmIntervals });
}
