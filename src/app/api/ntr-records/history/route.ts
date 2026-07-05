import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createNtrService } from '@/features/ntr/factory';
import { parseNtrHistoryFilterFromSearchParams } from '@/features/ntr/utils/parseHistoryFilter';

/**
 * Tractor Registry's server-side, paginated, filtered, searchable query -
 * never returns the full table, same "must scale" rule as PM's History
 * Center.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = parseNtrHistoryFilterFromSearchParams(searchParams, session);

  try {
    const result = await createNtrService().listHistory(filter);
    return NextResponse.json({ ok: true, data: result.data, total: result.total }, { status: 200 });
  } catch (error) {
    console.error('NTR history API error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}
