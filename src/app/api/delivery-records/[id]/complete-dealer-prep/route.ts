import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Dealer Preparation complete (stage 4). `DeliveryService.completeDealerPrep()`
 *  is unchanged (ADR-027) - this route surfaces it over HTTP with the same
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
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    const updated = await service.completeDealerPrep(params.id, notes, session, existing);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('complete dealer prep error', err);
    const notFound = typeof err?.message === 'string' && err.message.includes('not found');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: notFound ? 404 : 400 });
  }
}
