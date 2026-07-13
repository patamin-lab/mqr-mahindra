import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Customer Delivery (stage 5) — links an existing `NtrRecord`, never
 *  duplicates Customer/Machine/Photos/Delivery Date fields NTR already
 *  captures. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ntrId = String(body.ntrId ?? '').trim();
    if (!ntrId) {
      return NextResponse.json({ ok: false, error: 'ntrId is required' }, { status: 400 });
    }
    const updated = await service.linkNtr(params.id, ntrId, session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('link NTR to delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}
