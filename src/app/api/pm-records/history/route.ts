import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { parseMaintenanceHistoryFilterFromSearchParams } from '@/features/maintenance/utils/parseHistoryFilter';

/**
 * History Center's server-side, paginated, filtered, searchable query
 * (Phase 4a). Never returns the full table - always paginated - per the
 * "must scale to 100,000+ records, no client-side full dataset" spec.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = parseMaintenanceHistoryFilterFromSearchParams(searchParams, session);

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const result = await service.listHistory(filter, session);
    return NextResponse.json({ ok: true, data: result.data, total: result.total }, { status: 200 });
  } catch (error) {
    console.error('PM Record history API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}
