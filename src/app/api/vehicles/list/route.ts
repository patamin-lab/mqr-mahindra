import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listVehicles } from '@/lib/db';

/**
 * GET /api/vehicles/list
 *
 * Returns the full vehicle list scoped to the authenticated user's dealer.
 * SuperAdmin / CentralAdmin (dealerId = null) see all vehicles.
 * DealerAdmin / DealerUser see only their own dealer's vehicles.
 *
 * The report form and PM record form preload this on mount and filter
 * client-side, so one network round-trip covers the whole page visit.
 * Responses are cached in sessionStorage (5 min TTL) on the client.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const results = await listVehicles(session.dealerId);
  return NextResponse.json({ ok: true, results });
}
