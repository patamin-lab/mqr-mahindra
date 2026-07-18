import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { parseMaintenanceHistoryFilterFromSearchParams } from '@/features/maintenance/utils/parseHistoryFilter';
import { renderMaintenanceListPdf } from '@/features/maintenance/services/maintenancePdf';
import { buildMaintenanceRecordsCsv } from '@/features/maintenance/services/maintenanceCsv';
import type { MaintenanceRecord } from '@/features/maintenance/types';
import type { SessionUser } from '@/lib/types';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { PDF_LOCALE } from '@/lib/pdf/locale';

export const runtime = 'nodejs';

const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_PAGES = 10; // hard ceiling of 2000 records per export - a deliberate cap, not a silent truncation: recommend narrowing filters beyond this.

/** Fetches every page matching the filter up to EXPORT_MAX_PAGES, since
 *  listHistory() itself caps a single page at 200 (an interactive-UI
 *  safety limit, not meant to also be the export ceiling). */
async function fetchAllMatchingPages(
  service: MaintenanceService,
  filter: ReturnType<typeof parseMaintenanceHistoryFilterFromSearchParams>,
  session: SessionUser
): Promise<MaintenanceRecord[]> {
  const all: MaintenanceRecord[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const result = await service.listHistory({ ...filter, page, pageSize: EXPORT_PAGE_SIZE }, session);
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
  const formatParam = searchParams.get('format');
  const format = formatParam === 'pdf' ? 'pdf' : formatParam === 'csv' ? 'csv' : 'unsupported';
  const filter = parseMaintenanceHistoryFilterFromSearchParams(searchParams, session);

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  try {
    const records = await fetchAllMatchingPages(service, filter, session);
    const filenameBase = `pm-history-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'pdf') {
      // PDF content is always English (PDF_LOCALE) - `locale` here still
      // resolves the CSV export and this route's own JSON error messages.
      const buf = await renderMaintenanceListPdf(records, translate(PDF_LOCALE, 'pdf.pmListTitle'));
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
        },
      });
    }

    if (format === 'csv') {
      const buf = buildMaintenanceRecordsCsv(records, locale);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    return NextResponse.json({ ok: false, error: { code: 'UNSUPPORTED_FORMAT', message: 'unsupported format' } }, { status: 400 });
  } catch (error) {
    console.error('PM history export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: translate(locale, 'validation.exportFailed') } },
      { status: 500 }
    );
  }
}
