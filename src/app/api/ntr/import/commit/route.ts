import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { createNtrImportService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { findUserByUsername } from '@/lib/db';
import { sendImportCompletionEmail } from '@/lib/email';

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

  let body: { sessionId?: string; importMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } }, { status: 400 });
  }
  // Not persisted on the session row (no schema change) - the caller
  // must resend the same mode it used for /preview. See NtrImportMode's
  // doc comment.
  const importMode = body.importMode === 'strict' ? 'strict' : 'legacy';

  try {
    const result = await createNtrImportService().commit(body.sessionId, { username: session.username }, importMode);

    // Import Completion Notification (ADR-022, Task 15) - best-effort,
    // awaited so it's guaranteed to at least attempt before the response
    // returns (the same reliability principle Authentication Platform
    // v3.0.1 established for background sends), but a failure here must
    // never fail an import that already committed - `sendImportCompletionEmail`
    // itself never throws, this try/catch is defense in depth only.
    try {
      const importer = await findUserByUsername(session.username);
      if (importer?.email) {
        const baseUrl = new URL(req.url).origin;
        const durationMs =
          result.completed_at && result.started_at ? new Date(result.completed_at).getTime() - new Date(result.started_at).getTime() : 0;
        await sendImportCompletionEmail(
          importer.email,
          { filename: result.filename, imported: result.valid_count, skipped: result.skipped_count, failed: result.failed_count, durationMs },
          `${baseUrl}/admin/legacy-import?session=${encodeURIComponent(body.sessionId)}`
        );
      }
    } catch (notifyErr) {
      console.error('import completion notification error', notifyErr);
    }

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
