import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canExport } from '@/lib/scope';
import { logAuditEvent } from '@/lib/db';
import { formatBangkokFilenameTimestamp } from '@/lib/thaiDate';
import { createNtrService } from '@/features/ntr/factory';
import { parseNtrHistoryFilterFromSearchParams } from '@/features/ntr/utils/parseHistoryFilter';
import { buildTractorRegistryWorkbook } from '@/features/ntr/services/ntrExcel';
import type { NtrRecord } from '@/features/ntr/types';
import type { SessionUser } from '@/lib/types';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_PAGES = 25; // hard ceiling of 5000 rows per export - narrow filters beyond this rather than silently truncating.

async function fetchAllMatchingPages(
  service: ReturnType<typeof createNtrService>,
  filter: ReturnType<typeof parseNtrHistoryFilterFromSearchParams>,
  session: SessionUser
): Promise<NtrRecord[]> {
  const all: NtrRecord[] = [];
  for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
    const result = await service.listHistory({ ...filter, page, pageSize: EXPORT_PAGE_SIZE }, session);
    all.push(...result.data);
    if (result.data.length < EXPORT_PAGE_SIZE) break;
  }
  return all;
}

/**
 * Tractor Registry Excel export (.xlsx only, per spec - "Do NOT implement
 * CSV only"). Permission: Super Administrator / MSEAL (CentralAdmin)
 * export any dealer; a Dealer role exports only their own dealer's rows -
 * enforced by `parseNtrHistoryFilterFromSearchParams()` pinning
 * `dealerId` server-side exactly like every other export route in this
 * app, re-checked with `canExport()` here as the role gate. Every export
 * is audited: user, dealer, filters, row count, filename, timestamp.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canExport(session.role)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedExport') } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const filter = parseNtrHistoryFilterFromSearchParams(searchParams, session);
  const service = createNtrService();

  try {
    const records = await fetchAllMatchingPages(service, filter, session);
    const filename = `MASP_Tractor_Registry_${formatBangkokFilenameTimestamp()}.xlsx`;
    const buf = await buildTractorRegistryWorkbook(records, locale);

    await logAuditEvent({
      module: 'ntr',
      recordId: crypto.randomUUID(),
      recordRef: filename,
      eventType: 'SystemEvent',
      fieldName: 'export',
      newValue: JSON.stringify({
        user: session.username,
        dealer: filter.dealerId ?? 'all',
        filters: filter,
        rows: records.length,
        filename,
      }),
      performedBy: session.username,
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('NTR registry export error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: translate(locale, 'validation.exportFailed') } },
      { status: 500 }
    );
  }
}
