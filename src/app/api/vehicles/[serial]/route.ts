import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial, getVehicleHistory } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { lookupTractorBySerial } from '@/lib/tractorSheet';

export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const serial = decodeURIComponent(params.serial);

  const [vehicle, tractor] = await Promise.all([
    getVehicleBySerial(serial, seesAllDealers(session.role) ? null : session.dealerId),
    lookupTractorBySerial(serial).catch((err) => {
      console.error('tractor sheet lookup error', err);
      return null;
    }),
  ]);

  if (!vehicle && !tractor) {
    return NextResponse.json({ ok: false, found: false });
  }

  // Merge: Supabase `vehicles` (delivery date / dealer / warranty source of
  // truth) with the live "Tractor IN" sheet (model / engine / product code
  // master data). Either source alone is enough to consider the serial known.
  const merged = {
    serial: vehicle?.serial ?? tractor?.productSerial ?? serial,
    model: vehicle?.model || tractor?.productModel || null,
    delivery_date: vehicle?.delivery_date ?? null,
    dealer_id: vehicle?.dealer_id ?? null,
    engineSerial: tractor?.engineSerial ?? null,
    productCode: tractor?.productCode ?? null,
    pdiStatus: tractor?.pdiStatus ?? null,
    whArrivalDate: tractor?.whArrivalDate ?? null,
    source: vehicle && tractor ? 'both' : vehicle ? 'supabase' : 'tractor_in_sheet',
  };

  const history = vehicle ? await getVehicleHistory(serial, session) : [];
  return NextResponse.json({ ok: true, found: true, vehicle: merged, historyCount: history.length });
}
