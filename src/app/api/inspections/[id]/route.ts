import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const inspection = await service.getInspection(params.id);
    return NextResponse.json({ ok: true, inspection });
  } catch (err: any) {
    console.error('get inspection error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'not found' }, { status: 404 });
  }
}

/** One PATCH endpoint for every editable array on an Inspection - the
 *  checklist, a new finding, a new measurement, or a new part replaced -
 *  matching this task's own "one screen" model rather than four separate
 *  routes for what is really one editable record. Exactly one of
 *  `checklist`/`finding`/`measurement`/`partReplaced` is expected per
 *  call. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let updated;
    if (Array.isArray(body.checklist)) {
      updated = await service.updateChecklist(params.id, body.checklist, session);
    } else if (body.finding) {
      updated = await service.addFinding(
        params.id,
        { severity: body.finding.severity, system: String(body.finding.system ?? ''), description: String(body.finding.description ?? '') },
        session
      );
    } else if (body.measurement) {
      updated = await service.addMeasurement(
        params.id,
        {
          parameter: String(body.measurement.parameter ?? ''),
          value: Number(body.measurement.value),
          unit: String(body.measurement.unit ?? ''),
          specMin: body.measurement.specMin === null || body.measurement.specMin === undefined ? null : Number(body.measurement.specMin),
          specMax: body.measurement.specMax === null || body.measurement.specMax === undefined ? null : Number(body.measurement.specMax),
        },
        session
      );
    } else if (body.partReplaced) {
      updated = await service.addPartReplaced(
        params.id,
        {
          partName: String(body.partReplaced.partName ?? ''),
          partNumber: body.partReplaced.partNumber ? String(body.partReplaced.partNumber) : null,
          qty: Number(body.partReplaced.qty ?? 1),
          reason: String(body.partReplaced.reason ?? ''),
        },
        session
      );
    } else {
      return NextResponse.json({ ok: false, error: 'one of checklist, finding, measurement, or partReplaced is required' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('update inspection error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}
