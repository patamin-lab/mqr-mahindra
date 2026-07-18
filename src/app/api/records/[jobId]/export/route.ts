import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { getRecordByJobId } from '@/lib/db';
import { MasterDataService } from '@/shared/master-data';
import { canExport } from '@/lib/scope';
import { buildSingleRecordWorkbook } from '@/lib/exportExcel';
import { renderRecordPdf } from '@/lib/exportPdf';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { buildPdfFilename } from '@/lib/pdf/filename';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canExport(session.role)) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.unauthorizedExport') }, { status: 403 });
  }

  const jobId = decodeURIComponent(params.jobId);
  const record = await getRecordByJobId(jobId, session);
  if (!record) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.recordNotFound') }, { status: 404 });
  }

  try {
    const dealer = await MasterDataService.getDealerById(record.dealer_id);

    const { searchParams, origin } = new URL(req.url);
    const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
    const safeJobId = record.job_id.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'pdf') {
      // PDF content is always English (PDF_LOCALE, decided inside
      // renderRecordPdf) - `locale` here still resolves this route's own
      // JSON error messages and the Excel export below, which follow the
      // viewer's own UI locale as before.
      const buf = await renderRecordPdf(record, origin, dealer?.full_name, session.username);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${buildPdfFilename(record.job_id)}"`,
        },
      });
    }

    const buf = await buildSingleRecordWorkbook(record, dealer?.full_name);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeJobId}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('record export error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? translate(locale, 'validation.exportFailed') },
      { status: 500 }
    );
  }
}
