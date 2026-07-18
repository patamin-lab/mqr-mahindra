import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Stock Yard receipt (stage 2). `DeliveryService.receiveAtStockYard()` is
 *  unchanged (ADR-027) - this route surfaces it over HTTP and applies the
 *  same dealer-scope check every `[id]/*` Delivery Record route below
 *  applies (`DeliveryRecord` has no `branch_id`, so this is a direct
 *  dealer-id comparison, not the branch-aware `canAccessDealerBranch()`). */
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
    const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null;
    const updated = await service.receiveAtStockYard(params.id, location, session, existing);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('receive at stock yard error', err);
    const notFound = typeof err?.message === 'string' && err.message.includes('not found');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: notFound ? 404 : 400 });
  }
}
