import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { TractorInSyncService } from '@/features/vehicle/services/tractorInSyncService';

/**
 * Manually triggers the Tractor IN sync (see `TractorInSyncService`'s doc
 * comment) - the only endpoint that writes `vehicles.product_family_id`/
 * `vehicles.sub_model`. SuperAdmin-only: this is a bulk master-data write
 * across every vehicle, stricter than the usual SuperAdmin+CentralAdmin
 * admin-screen gating.
 *
 * `?dryRun=true` computes and returns the same insert/update/skip counts
 * without writing anything - use this before a production rollout to see
 * what a real run would do (see ADR-012's "v2.3.1: Sync Hardening"
 * section and the rollout runbook in `docs/releases/`).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'SuperAdmin') {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === 'true';

  try {
    const result = await new TractorInSyncService().sync({ triggeredBy: session.username, dryRun });
    console.log(dryRun ? 'Tractor IN sync dry-run completed' : 'Tractor IN sync completed', {
      dryRun: result.dryRun,
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
