import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { listRecords } from '@/lib/db';
import { canExport } from '@/lib/scope';
import { buildRecordsWorkbook } from '@/lib/exportExcel';
import { renderRecordsListPdf } from '@/lib/exportPdf';
import { buildRecordsCsv } from '@/lib/exportCsv';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { PDF_LOCALE } from '@/lib/pdf/locale';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canExport(session.role)) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.unauthorizedExport') }, { status: 403 });
  }

  try {
    const { searchParams, origin } = new URL(req.url);
    const formatParam = searchParams.get('format');
    const format = formatParam === 'pdf' ? 'pdf' : formatParam === 'csv' ? 'csv' : 'xlsx';
    const records = await listRecords(session, {
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      dealerId: searchParams.get('dealerId') ?? undefined,
      branchId: searchParams.get('branchId') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    });

    const filenameBase = `qir-records-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'pdf') {
      // Corporate PDF Standardization: PDF content is always English
      // (PDF_LOCALE), regardless of the viewer's own UI locale (`locale`,
      // still used below for this route's own JSON error messages, and
      // for the CSV export which is not a "production PDF").
      const buf = await renderRecordsListPdf(records, translate(PDF_LOCALE, 'pdf.mqrListTitle'), origin);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
        },
      });
    }

    if (format === 'csv') {
      const buf = buildRecordsCsv(records, locale);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    const buf = await buildRecordsWorkbook(records);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('records export error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? translate(locale, 'validation.exportFailed') },
      { status: 500 }
    );
  }
}
