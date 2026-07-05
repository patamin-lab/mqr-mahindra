import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { createNtrImportService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

/** Archive Queue view (Super Administrator only) - sessions currently
 *  'Archive Pending' or 'Archive Failed'. See
 *  docs/adr/ADR-008-Google-Drive-Decoupling.md. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  if (!canManageLegacyImport(session.role)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'forbidden' } }, { status: 403 });
  }

  try {
    const queue = await createNtrImportService().listArchiveQueue();
    return NextResponse.json({ ok: true, data: queue }, { status: 200 });
  } catch (error) {
    console.error('NTR legacy import archive queue error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}

/**
 * Processes the Archive Queue - uploads each queued/retryable session's
 * stored file to Google Drive. Body `{ sessionId }` retries one session;
 * an empty body processes the whole queue. A Drive failure here only ever
 * moves a session to 'Archive Failed' (retryable) - it never touches
 * `ntr_records`/`vehicles`, since those were already committed in a
 * separate, earlier database transaction (see `commit_ntr_legacy_import_row`).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canManageLegacyImport(session.role)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedLegacyImport') } },
      { status: 403 }
    );
  }

  let body: { sessionId?: string } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  try {
    const results = await createNtrImportService().processArchiveQueue({ username: session.username }, body.sessionId);
    return NextResponse.json({ ok: true, data: results }, { status: 200 });
  } catch (error) {
    console.error('NTR legacy import archive process error', error);
    const message = error instanceof Error ? error.message : translate(locale, 'validation.internalSystemError');
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
