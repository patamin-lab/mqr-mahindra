import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTractorInSyncHealth } from '@/lib/db';

/**
 * Read-only monitoring endpoint for the Tractor IN sync - the last run's
 * outcome plus a live `vehicles` count, so an operator can tell "did the
 * last sync work" and "is it stale" without querying Supabase directly.
 * Same SuperAdmin-only gating as the sync trigger itself (`../sync/route.ts`) -
 * this exposes operational detail (failure messages, row counts), not
 * business data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'SuperAdmin') {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const health = await getTractorInSyncHealth();
    return NextResponse.json({ ok: true, data: health });
  } catch (error) {
    console.error('Tractor IN sync health error', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
