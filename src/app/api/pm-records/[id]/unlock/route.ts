import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';

const MAX_UNLOCK_HOURS = 168; // 7 days - a generous cap so a mistyped value can't leave a record unlocked indefinitely.

/** Temporary override window - Central/SuperAdmin only (also re-checked in
 *  the Service layer). Body: `{ hours?: number }`, defaults to 24. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึง' } }, { status: 403 });
  }

  let hours = 24;
  try {
    const body = await req.json();
    if (typeof body?.hours === 'number' && Number.isFinite(body.hours) && body.hours > 0) {
      hours = Math.min(body.hours, MAX_UNLOCK_HOURS);
    }
  } catch {
    // No JSON body - use the default.
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const record = await service.unlock(params.id, { username: session.username, role: session.role }, hours);
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record unlock API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
