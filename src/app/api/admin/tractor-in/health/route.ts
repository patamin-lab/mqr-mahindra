import { NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { canManageTractorInSync } from '@/lib/scope';
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
  if (!session) return unauthorizedError();
  if (!canManageTractorInSync(session.role)) {
    return forbiddenError();
  }

  try {
    const health = await getTractorInSyncHealth();
    return NextResponse.json({ ok: true, data: health });
  } catch (error) {
    console.error('Tractor IN sync health error', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
