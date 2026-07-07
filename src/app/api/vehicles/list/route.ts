import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listVehicles } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // Vehicles are dealer-level master data (synced from the "Tractor IN"
  // sheet, often with no branch_id) - scoped to dealer only, not branch;
  // the sensitive per-record data (NTR/PM/MQR history) a DealerUser sees
  // for any given vehicle is still correctly branch-scoped by each
  // module's own provider.
  const { dealerId } = resolveDealerScope(session, null);

  try {
    const results = await listVehicles(dealerId);
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('vehicle list error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'โหลดรายการรถไม่สำเร็จ' }, { status: 500 });
  }
}
