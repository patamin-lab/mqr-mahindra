import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = resolveDealerScope(session, searchParams.get('dealerId'));

  try {
    const stats = await service.getDashboardStats(scope.dealerId ?? undefined);
    return NextResponse.json({ ok: true, stats });
  } catch (err: any) {
    console.error('delivery dashboard stats error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}
