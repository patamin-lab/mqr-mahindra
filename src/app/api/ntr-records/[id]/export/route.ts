import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { createNtrService } from '@/features/ntr/factory';
import { renderNtrRecordPdf } from '@/features/ntr/services/ntrPdf';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { unauthorizedError } from '@/lib/apiError';
import { buildPdfFilename } from '@/lib/pdf/filename';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  const record = await createNtrService().getById(params.id, session);
  if (!record) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'NTR record not found' } }, { status: 404 });
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
    const [dealer, branch, productFamily, summary, timeline] = await Promise.all([
      MasterDataService.getDealerById(record.dealer_id),
      record.branch_id ? MasterDataService.getBranch(record.branch_id) : Promise.resolve(null),
      record.product_family_id ? MasterDataService.getProductFamilyById(record.product_family_id) : Promise.resolve(null),
      getVehicleSummary(record.serial, session),
      getVehicleTimeline(record.serial, session),
    ]);

    // PDF content is always English (PDF_LOCALE, decided inside
    // renderNtrRecordPdf) - `locale` here still resolves this route's own
    // JSON error messages, which follow the viewer's own UI locale.
    const buf = await renderNtrRecordPdf(record, origin, {
      dealerName: dealer?.full_name,
      branchName: branch?.name ?? null,
      productFamilyName: productFamily?.name ?? null,
      summary,
      timeline,
      generatedBy: session.username,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildPdfFilename(record.ntr_number)}"`,
      },
    });
  } catch (error) {
    console.error('NTR record export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: translate(locale, 'validation.exportFailed') } },
      { status: 500 }
    );
  }
}
