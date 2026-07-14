import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';
import { InspectionService } from '@/features/inspection';

const service = new DeliveryService();
const inspectionService = new InspectionService();

/** PDI (stage 3) — links an existing `Inspection` (ADR-017), never
 *  duplicates its fields onto `delivery_records`. Advances to
 *  `DealerPreparation` once the linked inspection is `Completed`. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const inspectionId = String(body.inspectionId ?? '').trim();
    if (!inspectionId) {
      return NextResponse.json({ ok: false, error: 'inspectionId is required' }, { status: 400 });
    }
    const [inspection] = await inspectionService.listInspectionsByIds([inspectionId]);
    if (!inspection) {
      return NextResponse.json({ ok: false, error: `Inspection ${inspectionId} not found` }, { status: 404 });
    }
    const updated = await service.linkInspection(params.id, inspectionId, inspection.status === 'Completed', session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('link inspection to delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}
