import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { TractorInSyncService } from '@/features/vehicle/services/tractorInSyncService';

/**
 * Manually triggers the Tractor IN sync (see `TractorInSyncService`'s doc
 * comment) - the only endpoint that writes `vehicles.product_family_id`/
 * `vehicles.sub_model`. SuperAdmin-only: this is a bulk master-data write
 * across every vehicle, stricter than the usual SuperAdmin+CentralAdmin
 * admin-screen gating.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'SuperAdmin') {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const result = await new TractorInSyncService().sync(session.username);
    console.log('Tractor IN sync completed', {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      durationMs: result.durationMs,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Tractor IN sync error', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
