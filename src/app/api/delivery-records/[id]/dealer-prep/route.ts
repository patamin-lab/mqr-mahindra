import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Dealer Preparation (stage 4). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const notes = body.notes ? String(body.notes) : null;
    const updated = await service.completeDealerPrep(params.id, notes, session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('complete dealer preparation error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}
