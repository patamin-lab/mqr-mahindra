import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';

/** Explicit "Administrative Lock" action - Central/SuperAdmin only (also
 *  re-checked in the Service layer, which is the trusted enforcement
 *  point per spec; this route-level check is defense in depth, matching
 *  every other admin-gated route in this app). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  if (!seesAllDealers(session.role)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึง' } }, { status: 403 });
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const record = await service.lock(params.id, { username: session.username, role: session.role });
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record lock API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
