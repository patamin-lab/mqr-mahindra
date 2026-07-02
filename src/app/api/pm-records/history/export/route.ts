import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { parseMaintenanceHistoryFilterFromSearchParams } from '@/features/maintenance/utils/parseHistoryFilter';
import { renderMaintenanceListPdf } from '@/features/maintenance/services/maintenancePdf';
import type { MaintenanceRecord } from '@/features/maintenance/types';

export const runtime = 'nodejs';

const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_PAGES = 10; // hard ceiling of 2000 records per export - a deliberate cap, not a silent truncation: recommend narrowing filters beyond this.

/** Fetches every page matching the filter up to EXPORT_MAX_PAGES, since
 *  listHistory() itself caps a single page at 200 (an interactive-UI
 *  safety limit, not meant to also be the export ceiling). */
async function fetchAllMatchingPages(
  service: MaintenanceService,
  filter: ReturnType<typeof parseMaintenanceHistoryFilterFromSearchParams>
): Promise<MaintenanceRecord[]> {
  const all: MaintenanceRecord[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const result = await service.listHistory({ ...filter, page, pageSize: EXPORT_PAGE_SIZE });
    all.push(...result.data);
    if (result.data.length < EXPORT_PAGE_SIZE) break;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
  const filter = parseMaintenanceHistoryFilterFromSearchParams(searchParams, session);

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const records = await fetchAllMatchingPages(service, filter);
    const filenameBase = `pm-history-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'pdf') {
      const buf = await renderMaintenanceListPdf(records, 'ประวัติการบำรุงรักษา (PM History)');
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
        },
      });
    }

    return NextResponse.json({ ok: false, error: { code: 'UNSUPPORTED_FORMAT', message: 'unsupported format' } }, { status: 400 });
  } catch (error) {
    console.error('PM history export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'ส่งออกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' } },
      { status: 500 }
    );
  }
}
