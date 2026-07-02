import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDealer, getPmInterval } from '@/lib/db';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { renderMaintenanceRecordPdf } from '@/features/maintenance/services/maintenancePdf';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  const record = await service.getById(params.id);
  if (!record) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } }, { status: 404 });
  }
  // Zero-leakage: a non-privileged actor may only export their own dealer's record.
  if (session.dealerId && record.dealer_id !== session.dealerId) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงรายการนี้' } }, { status: 403 });
  }

  try {
    const { origin } = new URL(req.url);
    const [dealer, interval] = await Promise.all([
      getDealer(record.dealer_id),
      record.pm_interval_id ? getPmInterval(record.pm_interval_id) : Promise.resolve(null),
    ]);
    const safeId = (record.pm_number ?? record.id).replace(/[^a-zA-Z0-9_-]/g, '_');

    const buf = await renderMaintenanceRecordPdf(record, origin, {
      dealerName: dealer?.full_name,
      intervalLabel: interval?.label,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PM record export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'ส่งออกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' } },
      { status: 500 }
    );
  }
}
