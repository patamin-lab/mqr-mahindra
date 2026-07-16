import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Delivery Acceptance (stage 7) - the trust-conferring action.
 *  `DeliveryService.recordAcceptance()` already enforces
 *  `canApproveDelivery` (SuperAdmin/CentralAdmin/DealerAdmin only) and is
 *  unchanged (ADR-027) - this route additionally applies the same
 *  dealer-scope check every `[id]/*` Delivery Record route applies. */
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

    const body = await req.json().catch(() => ({}));
    const acceptanceNotes = typeof body.acceptanceNotes === 'string' && body.acceptanceNotes.trim() ? body.acceptanceNotes.trim() : null;
    const updated = await service.recordAcceptance(params.id, { acceptanceNotes }, session);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('record delivery acceptance error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not record Delivery Acceptance');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}
