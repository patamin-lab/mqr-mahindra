import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { createNtrService } from '@/features/ntr/factory';
import { renderNtrRecordPdf } from '@/features/ntr/services/ntrPdf';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
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
    const safeId = record.ntr_number.replace(/[^a-zA-Z0-9_-]/g, '_');

    const buf = await renderNtrRecordPdf(record, origin, {
      dealerName: dealer?.full_name,
      branchName: branch?.name ?? null,
      productFamilyName: productFamily?.name ?? null,
      summary,
      timeline,
      generatedBy: session.username,
      locale,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeId}.pdf"`,
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
