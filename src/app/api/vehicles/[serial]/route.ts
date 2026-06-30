import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial } from '@/lib/db';

/**
 * GET /api/vehicles/[serial]
 *
 * Exact-match lookup by serial number. Dealer-scoped (SuperAdmin / CentralAdmin
 * pass null and see all dealers). Used as a fallback by the vehicle autocomplete
 * when the user types a serial that isn't in the preloaded list (e.g. a unit
 * that arrived after the last sync).
 *
 * Returns:
 *   { ok: true, found: true, vehicle: Vehicle }   — serial found
 *   { ok: true, found: false }                    — serial not found (not an error)
 *   { ok: false, error: 'unauthorized' }          — no session
 */
export async function GET(
  _req: Request,
  { params }: { params: { serial: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const serial = decodeURIComponent(params.serial).trim();
  const vehicle = await getVehicleBySerial(serial, session.dealerId);

  if (!vehicle) return NextResponse.json({ ok: true, found: false });
  return NextResponse.json({ ok: true, found: true, vehicle });
}
