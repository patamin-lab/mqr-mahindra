import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { createNtrImportService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { formatUnsupportedTemplateMessage, requiredFieldsOf } from '@/shared/import';
import { validateNtrImportHeader } from '@/features/ntr/services/ntrImportParser';
import { NTR_IMPORT_CONTRACT } from '@/features/ntr/services/ntrImportFields';

export const runtime = 'nodejs';

/**
 * Legacy Import step 1/2: Upload -> Validation -> Preview. Writes only the
 * `ntr_import_sessions` row itself (status='Validated') - no `ntr_records`
 * or `vehicles` row is created until the operator confirms via
 * `/api/ntr/import/commit`. Super Administrator only, checked here before
 * any database access, per docs/standards/SECURITY_STANDARD.md.
 *
 * Google Drive is never called here (see
 * docs/adr/ADR-008-Google-Drive-Decoupling.md) - the uploaded file's bytes
 * are stored directly in `ntr_import_sessions.file_content`, so this step,
 * and `commit()` after it, never depend on Drive being reachable.
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

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: translate(locale, 'validation.importFileRequired') } },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // Header Validation (Step 2/3), via the shared framework's
    // `validateHeader()`. A file with none of its required columns
    // recognized at all isn't a malformed NTR file, it's the wrong file
    // entirely - reject it with one clear message instead of a wall of
    // per-row "missing X" failures, and without writing a session row for
    // it. (A file missing just one or two required columns still proceeds
    // to `preview()` - those columns' rows simply fail per-row, which is
    // more useful than a blanket rejection for an otherwise-valid file.)
    const headerValidation = await validateNtrImportHeader(buffer, file.name);
    const requiredFieldCount = requiredFieldsOf(NTR_IMPORT_CONTRACT).length;
    if (headerValidation.missingRequiredColumns.length === requiredFieldCount) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: formatUnsupportedTemplateMessage() } },
        { status: 400 }
      );
    }

    const importService = createNtrImportService();
    const { session: importSession, preview } = await importService.preview(buffer, file.name, { username: session.username });

    return NextResponse.json(
      {
        ok: true,
        data: {
          sessionId: importSession.id,
          preview,
          fileInfo: {
            filename: file.name,
            fileSize: buffer.length,
            rowCount: preview.totalRecords,
            detectedTemplateVersion: headerValidation.detected.templateVersion,
            expectedTemplateVersion: NTR_IMPORT_CONTRACT.templateVersion,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('NTR legacy import preview error', error);
    const message = error instanceof Error ? error.message : translate(locale, 'validation.internalSystemError');
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
