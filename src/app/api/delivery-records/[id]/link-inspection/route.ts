import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';
import { InspectionService } from '@/features/inspection';

const service = new DeliveryService();
const inspectionService = new InspectionService();

/** Links a completed/in-progress Import Inspection (PDI, stage 3) to this
 *  Delivery record. `inspectionCompleted` is resolved server-side via
 *  `InspectionService.listInspectionsByIds()` (the same dealer-visible,
 *  non-MSEAL-gated read `DeliveryService.getDeliveryForMachine()` already
 *  uses for this exact purpose) rather than trusted from the client.
 *  `DeliveryService.linkInspection()` itself already enforces
 *  `canAccessImportInspection` and is unchanged. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const existing = await service.getDelivery(params.id);
    if (!seesAllDealers(session.role) && session.dealerId !== existing.dealerId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json();
    const inspectionId = String(body.inspectionId ?? '').trim();
    if (!inspectionId) {
      return NextResponse.json({ ok: false, error: 'inspectionId is required' }, { status: 400 });
    }
    const [inspection] = await inspectionService.listInspectionsByIds([inspectionId]);
    if (!inspection) {
      return NextResponse.json({ ok: false, error: `Inspection ${inspectionId} not found` }, { status: 404 });
    }

    const updated = await service.linkInspection(params.id, inspectionId, inspection.status === 'Completed', session, existing);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('link inspection to delivery record error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not link an Import Inspection');
    const notFound = typeof err?.message === 'string' && err.message.includes('not found');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : notFound ? 404 : 400 });
  }
}
