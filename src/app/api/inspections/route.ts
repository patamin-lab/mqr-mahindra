import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { InspectionService, type InspectionStatus, type ReleaseStatus } from '@/features/inspection';

const service = new InspectionService();

function forbidden(err: any): boolean {
  return typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
}

/** List Import Inspections. MSEAL-only (`canAccessImportInspection`,
 *  enforced inside `InspectionService`) - Dealer roles get 403, not a
 *  filtered/empty list, matching `SECURITY_STANDARD.md`'s "server-side
 *  enforced, not just hidden." Dealer-scoped like every other dealer-
 *  owned record (MQR/PM/NTR) for SuperAdmin/CentralAdmin's own dealer
 *  filter param. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as InspectionStatus | null;
  const releaseStatus = searchParams.get('releaseStatus') as ReleaseStatus | null;
  const q = searchParams.get('q') ?? undefined;
  const scope = resolveDealerScope(session, searchParams.get('dealerId'));

  try {
    const inspections = await service.listInspections(
      {
        status: status ?? undefined,
        releaseStatus: releaseStatus ?? undefined,
        dealerId: scope.dealerId ?? undefined,
        q,
      },
      session
    );
    return NextResponse.json({ ok: true, inspections });
  } catch (err: any) {
    console.error('list inspections error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden(err) ? 403 : 500 });
  }
}

/** Creates the Initial Import Inspection (`inspectionType: 'PDI'`,
 *  `inspectionReason: 'INITIAL'`, `inspectionSequence: 1`) starting from
 *  the seeded default checklist (`DEFAULT_PDI_CHECKLIST`) — `serial`
 *  resolves to the vehicle via the existing scoped `getVehicleBySerial()`
 *  read, never a second vehicle lookup path. RE-PDI is created through
 *  `[id]/re-pdi`, not here - this route always starts a new machine's
 *  first inspection event. */
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
    const technicianName = String(body.technicianName ?? session.fullName ?? session.username).trim();

    const created = await service.createInitialInspection(
      {
        vehicleId: vehicle.id,
        serial: vehicle.serial,
        dealerId: vehicle.dealer_id ?? session.dealerId,
        technicianId: body.technicianId ? String(body.technicianId) : null,
        technicianName,
        technicianCertificationRef: body.technicianCertificationRef ? String(body.technicianCertificationRef) : null,
      },
      session
    );
    return NextResponse.json({ ok: true, inspection: created }, { status: 201 });
  } catch (err: any) {
    console.error('create inspection error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden(err) ? 403 : 500 });
  }
}
