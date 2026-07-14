import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial, getVehicleHistory } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { lookupTractorBySerial } from '@/lib/tractorSheet';

export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const serial = decodeURIComponent(params.serial);

  // Vehicles are dealer-level master data - scoped to dealer only, not
  // branch (see api/vehicles/list/route.ts's comment).
  const [vehicle, tractor] = await Promise.all([
    getVehicleBySerial(serial, resolveDealerScope(session, null)),
    lookupTractorBySerial(serial).catch((err) => {
      console.error('tractor sheet lookup error', err);
      return null;
    }),
  ]);

  if (!vehicle && !tractor) {
    return NextResponse.json({ ok: false, found: false });
  }

  // Merge: `vehicles` (synced from Tractor IN, the sole vehicle master) is
  // authoritative for every master field; the live sheet is only a
  // fallback for a serial that exists on the sheet but hasn't been synced
  // yet. Either source alone is enough to consider the serial known.
  const merged = {
    serial: vehicle?.serial ?? tractor?.productSerial ?? serial,
    model: vehicle?.model || tractor?.productModel || null,
    engine_number: vehicle?.engine_number || tractor?.engineSerial || null,
    product_code: vehicle?.product_code || tractor?.productCode || null,
    dealer_id: vehicle?.dealer_id ?? null,
    wh_arrival_date: vehicle?.wh_arrival_date || tractor?.whArrivalDate || null,
    delivery_date: vehicle?.delivery_date ?? null,
    source: vehicle && tractor ? 'both' : vehicle ? 'supabase' : 'tractor_in_sheet',
  };

  const history = vehicle ? await getVehicleHistory(serial, session) : [];
  return NextResponse.json({ ok: true, found: true, vehicle: merged, historyCount: history.length });
}
