import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, getDealer } from '@/lib/db';
import { canExport } from '@/lib/scope';
import { buildSingleRecordWorkbook } from '@/lib/exportExcel';
import { renderRecordPdf } from '@/lib/exportPdf';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
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
    const dealer = await getDealer(record.dealer_id);

    const { searchParams, origin } = new URL(req.url);
    const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
    const safeJobId = record.job_id.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'pdf') {
      const buf = await renderRecordPdf(record, origin, dealer?.full_name, locale);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeJobId}.pdf"`,
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
