import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Stock Yard (stage 2). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const location = body.location ? String(body.location) : null;
    const updated = await service.receiveAtStockYard(params.id, location, session);
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('receive at stock yard error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}
