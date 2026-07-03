import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDealer } from '@/lib/db';
import { createNtrService } from '@/features/ntr/factory';
import { renderNtrRecordPdf } from '@/features/ntr/services/ntrPdf';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  const record = await createNtrService().getById(params.id);
  if (!record) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'NTR record not found' } }, { status: 404 });
  }
  // Zero-leakage: a non-privileged actor may only export their own dealer's record.
  if (session.dealerId && record.dealer_id !== session.dealerId) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedRecordAccess') } },
      { status: 403 }
    );
  }

  try {
    const { origin } = new URL(req.url);
    const dealer = await getDealer(record.dealer_id);
    const safeId = record.ntr_number.replace(/[^a-zA-Z0-9_-]/g, '_');

    const buf = await renderNtrRecordPdf(record, origin, { dealerName: dealer?.full_name, locale });
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
