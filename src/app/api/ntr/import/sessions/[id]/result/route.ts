import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { createNtrImportService } from '@/features/ntr/factory';
import { NtrImportMode } from '@/features/ntr/types';

export const runtime = 'nodejs';

/**
 * `NTR_IMPORT_RESULT.xlsx` - downloadable per session, re-validated fresh
 * from the session's stored file (never a client-supplied row list) so
 * the report always matches a real, reproducible validation pass. See
 * `docs/import/NTR_HISTORICAL_IMPORT.md`'s Error Messages section.
 * Super Administrator only, same gate as every other Legacy Import route.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  if (!canManageLegacyImport(session.role)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'forbidden' } }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const importMode: NtrImportMode = searchParams.get('importMode') === 'strict' ? 'strict' : 'legacy';

  try {
    const buffer = await createNtrImportService().buildResultWorkbook(params.id, importMode);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="NTR_IMPORT_RESULT.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const isNotFound = message === 'Import session not found';
    return NextResponse.json(
      { ok: false, error: { code: isNotFound ? 'NOT_FOUND' : 'INTERNAL_ERROR', message } },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
