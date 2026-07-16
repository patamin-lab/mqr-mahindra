import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { DeliveryService, type DeliveryStage } from '@/features/delivery';

const service = new DeliveryService();

/** List Delivery Records. Dealer-scoped like every other dealer-owned
 *  record (MQR/PM/NTR/Import Inspection) - `DeliveryRecord` has no
 *  `branch_id` column, so scope here is dealer-only, via the same
 *  `resolveDealerScope()` every other list route already calls.
 *  `DeliveryService.listDeliveries()` itself is unchanged (ADR-027) -
 *  this route only resolves which `dealerId` to filter by. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage') as DeliveryStage | null;
  const q = searchParams.get('q') ?? undefined;
  const scope = resolveDealerScope(session, searchParams.get('dealerId'));

  try {
    const records = await service.listDeliveries({
      stage: stage ?? undefined,
      dealerId: scope.dealerId ?? undefined,
      q,
    });
    return NextResponse.json({ ok: true, records });
  } catch (err: any) {
    console.error('list delivery records error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

/** Starts Delivery lifecycle tracking (stage `TractorIn`) for a vehicle
 *  that already exists in `vehicles` (Tractor In, ADR-012) - never
 *  duplicates the vehicle row itself. `serial` resolves to the vehicle
 *  via the existing scoped `getVehicleBySerial()` read (same pattern
 *  `POST /api/inspections` already uses), so a non-privileged session can
 *  never start tracking for a vehicle outside their own dealer, and the
 *  dealer_id written is always the vehicle's own real one, never a
 *  client-supplied value. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
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
      {
        vehicleId: vehicle.id,
        serial: vehicle.serial,
        dealerId: vehicle.dealer_id ?? session.dealerId,
      },
      session
    );
    return NextResponse.json({ ok: true, record: created }, { status: 201 });
  } catch (err: any) {
    console.error('create delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}
