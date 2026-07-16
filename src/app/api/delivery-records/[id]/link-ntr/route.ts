import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';
import { createNtrService } from '@/features/ntr/factory';

const service = new DeliveryService();
const ntrService = createNtrService();

/** Links the NTR record that completed Customer Delivery (stage 5) to this
 *  Delivery record. Verifies the NTR's own `serial` matches this Delivery
 *  record's serial before linking - an NTR for a different tractor must
 *  never be attachable here, even by mistake. `DeliveryService.linkNtr()`
 *  itself is unchanged (ADR-027). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const ntrId = String(body.ntrId ?? '').trim();
    if (!ntrId) {
      return NextResponse.json({ ok: false, error: 'ntrId is required' }, { status: 400 });
    }
    const [delivery, ntr] = await Promise.all([service.getDelivery(params.id), ntrService.getById(ntrId, session)]);
    if (!seesAllDealers(session.role) && session.dealerId !== delivery.dealerId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!ntr) {
      return NextResponse.json({ ok: false, error: `NTR record ${ntrId} not found` }, { status: 404 });
    }
    if (ntr.serial !== delivery.serial) {
      return NextResponse.json({ ok: false, error: 'ntrId does not belong to this delivery record\'s serial' }, { status: 400 });
    }

    const updated = await service.linkNtr(params.id, ntrId, session);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('link ntr to delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}
