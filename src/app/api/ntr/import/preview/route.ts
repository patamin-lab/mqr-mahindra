import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { uploadFileToDrive } from '@/lib/googleDrive';
import { createNtrImportService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export const runtime = 'nodejs';

/**
 * Legacy Import step 1/2: Upload -> Validation -> Preview. Writes only the
 * `ntr_import_sessions` row itself (status='Pending') - no `ntr_records`
 * or `vehicles` row is created until the operator confirms via
 * `/api/ntr/import/commit`. Super Administrator only, checked here before
 * any database access, per docs/standards/SECURITY_STANDARD.md.
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
    // Store the original uploaded file (spec: "Store original uploaded
    // file") in the same Drive integration every other attachment uses -
    // no new file-storage mechanism for this module.
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const filename = `legacy-import-${Date.now()}.${ext}`;
    const { url } = await uploadFileToDrive({
      buffer,
      filename,
      mimeType: file.type || 'application/octet-stream',
      dealerFolderName: 'ntr_legacy_import',
    });

    const importService = createNtrImportService();
    const { session: importSession, preview } = await importService.preview(buffer, file.name, url, { username: session.username });

    return NextResponse.json({ ok: true, data: { sessionId: importSession.id, preview } }, { status: 200 });
  } catch (error) {
    console.error('NTR legacy import preview error', error);
    const message = error instanceof Error ? error.message : translate(locale, 'validation.internalSystemError');
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
