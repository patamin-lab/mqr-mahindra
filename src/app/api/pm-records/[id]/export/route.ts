import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPmInterval } from '@/lib/db';
import { MasterDataService } from '@/shared/master-data';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { renderMaintenanceRecordPdf } from '@/features/maintenance/services/maintenancePdf';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { buildPdfFilename } from '@/lib/pdf/filename';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  const record = await service.getById(params.id, session);
  if (!record) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } }, { status: 404 });
  }
  // Dealer/Branch Scope Platform Standard: a non-privileged actor may only
  // export their own dealer's/branch's record - not just dealer-level.
  if (!canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedRecordAccess') } },
      { status: 403 }
    );
  }

  try {
    const { origin } = new URL(req.url);
    const [dealer, interval] = await Promise.all([
      MasterDataService.getDealerById(record.dealer_id),
      record.pm_interval_id ? getPmInterval(record.pm_interval_id) : Promise.resolve(null),
    ]);
    // PDF content is always English (PDF_LOCALE, decided inside
    // renderMaintenanceRecordPdf) - `locale` here still resolves this
    // route's own JSON error messages, which follow the viewer's own UI
    // locale.
    const buf = await renderMaintenanceRecordPdf(record, origin, {
      dealerName: dealer?.full_name,
      intervalLabel: interval?.label,
      generatedBy: session.username,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildPdfFilename(record.pm_number ?? record.id)}"`,
      },
    });
  } catch (error) {
    console.error('PM record export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: translate(locale, 'validation.exportFailed') } },
      { status: 500 }
    );
  }
}
