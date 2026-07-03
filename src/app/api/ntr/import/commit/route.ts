import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { createNtrImportService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

/**
 * Legacy Import step 2/2: Import -> Summary -> Audit. Only ever called
 * after the operator has reviewed the preview from
 * `/api/ntr/import/commit`'s sibling `preview` route. Re-parses and
 * re-validates the stored file itself server-side (see
 * `NtrImportService.commit()`) rather than trusting a client-supplied row
 * list. Super Administrator only, checked before any database access.
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

  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } }, { status: 400 });
  }

  try {
    const result = await createNtrImportService().commit(body.sessionId, { username: session.username });
    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    console.error('NTR legacy import commit error', error);
    const message = error instanceof Error ? error.message : translate(locale, 'validation.internalSystemError');
    const isNotFound = message === 'Import session not found';
    return NextResponse.json(
      { ok: false, error: { code: isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR', message: isNotFound ? translate(locale, 'validation.importSessionNotFound') : message } },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
