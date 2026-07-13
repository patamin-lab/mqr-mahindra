import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Delivery Acceptance (stage 7) — gated server-side by
 *  `canApproveDelivery` inside `DeliveryService.recordAcceptance()`, which
 *  also auto-triggers Warranty Activation. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const updated = await service.recordAcceptance(params.id, { acceptanceNotes: body.acceptanceNotes ? String(body.acceptanceNotes) : null }, session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('record delivery acceptance error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not record');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}
