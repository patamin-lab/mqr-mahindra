import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { TractorInSyncService, DATA_QUALITY_REASON } from '@/features/vehicle/services/tractorInSyncService';

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
    // Data-quality report - counts, never a sync failure. Missing Product
    // Code / WH Arrival Date means the corresponding sheet cell is blank
    // in Tractor IN; this sync never generates, infers, or backfills a
    // value, so the count is informational only.
    console.log(dryRun ? 'Tractor IN sync dry-run report' : 'Tractor IN sync report', {
      rowsProcessed: result.totalRows,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      durationMs: result.durationMs,
      missingProductCode: result.missingProductCode,
      missingWhArrivalDate: result.missingWhArrivalDate,
      missingFieldReason: DATA_QUALITY_REASON,
    });
    return NextResponse.json({
      ok: true,
      result,
      dataQuality: {
        missingProductCode: result.missingProductCode,
        missingWhArrivalDate: result.missingWhArrivalDate,
        reason: DATA_QUALITY_REASON,
      },
    });
  } catch (error) {
    console.error('Tractor IN sync error', error);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
