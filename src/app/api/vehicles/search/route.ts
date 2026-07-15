import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchVehicles, searchVehiclesByModel } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const model = searchParams.get('model');
  // Vehicles are dealer-level master data - scoped to dealer only, not
  // branch (see api/vehicles/list/route.ts's comment).
  const { dealerId } = resolveDealerScope(session, null);

  try {
    // `model` present -> Vehicle 360's model-scoped, multi-field (serial/
    // engine/product code) search. Absent -> unchanged, existing
    // serial-only + Tractor IN sheet search every other caller (e.g. the
    // report form's typeahead) already depends on - no behavior change
    // for them.
    if (model?.trim()) {
      const results = await searchVehiclesByModel(model, q, dealerId);
      return NextResponse.json({ ok: true, results });
    }
    const results = await searchVehicles(q, dealerId);
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('vehicle search error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'ค้นหาไม่สำเร็จ' }, { status: 500 });
  }
}
