import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Warranty Activation (stage 8) - manual/out-of-band activation. The
 *  normal path is automatic via `recordAcceptance()`; this route exists
 *  for the rare case Delivery Acceptance was recorded outside this
 *  platform (e.g. a historical/migrated record). Gated by
 *  `canApproveDelivery`. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const updated = await service.activateWarranty(params.id, 'Manual', session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('activate warranty error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not manually activate');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}
