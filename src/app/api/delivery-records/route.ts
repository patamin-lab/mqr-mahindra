import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { DeliveryService, type DeliveryStage } from '@/features/delivery';

const service = new DeliveryService();

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage') as DeliveryStage | null;
  const q = searchParams.get('q') ?? undefined;
  const scope = resolveDealerScope(session, searchParams.get('dealerId'));

  try {
    const deliveries = await service.listDeliveries({ stage: stage ?? undefined, dealerId: scope.dealerId ?? undefined, q });
    return NextResponse.json({ ok: true, deliveries });
  } catch (err: any) {
    console.error('list delivery records error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

/** Tractor In (stage 1) — starts the Delivery aggregate's own tracking
 *  for a vehicle that already exists via the existing Tractor In Sync
 *  (ADR-012). `serial` resolves to the vehicle via the existing scoped
 *  `getVehicleBySerial()` read, same as Inspection's create route. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const serial = String(body.serial ?? '').trim();
    if (!serial) {
      return NextResponse.json({ ok: false, error: 'serial is required' }, { status: 400 });
    }
    const vehicle = await getVehicleBySerial(serial, resolveDealerScope(session, null));
    if (!vehicle) {
      return NextResponse.json({ ok: false, error: `Vehicle ${serial} not found` }, { status: 404 });
    }

    const created = await service.createDeliveryRecord(
      { vehicleId: vehicle.id, serial: vehicle.serial, dealerId: vehicle.dealer_id ?? session.dealerId },
      session
    );
    return NextResponse.json({ ok: true, delivery: created }, { status: 201 });
  } catch (err: any) {
    console.error('create delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}
