import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const delivery = await service.getDelivery(params.id);
    return NextResponse.json({ ok: true, delivery });
  } catch (err: any) {
    console.error('get delivery record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'not found' }, { status: 404 });
  }
}
