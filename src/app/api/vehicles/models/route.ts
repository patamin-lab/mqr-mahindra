import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDistinctVehicleModels } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // Same dealer-only scoping as /api/vehicles/list - vehicles are
  // dealer-level master data.
  const { dealerId } = resolveDealerScope(session, null);

  try {
    const models = await getDistinctVehicleModels(dealerId);
    return NextResponse.json({ ok: true, models });
  } catch (err: any) {
    console.error('vehicle models list error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'โหลดรายการรุ่นรถไม่สำเร็จ' }, { status: 500 });
  }
}
