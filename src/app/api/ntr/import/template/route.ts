import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { buildImportTemplate } from '@/shared/import';
import { NTR_IMPORT_FIELDS, NTR_IMPORT_INSTRUCTIONS, NTR_IMPORT_TEMPLATE_META } from '@/features/ntr/services/ntrImportFields';

export const runtime = 'nodejs';

/** Import Wizard Step 1 - downloadable .xlsx template (Instructions + Data
 *  + `_META` sheets). Super Administrator only, same gate as every other
 *  Legacy Import route. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }
  if (!canManageLegacyImport(session.role)) {
    return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'forbidden' } }, { status: 403 });
  }

  const buffer = await buildImportTemplate({
    meta: NTR_IMPORT_TEMPLATE_META,
    fields: NTR_IMPORT_FIELDS,
    instructions: NTR_IMPORT_INSTRUCTIONS,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="ntr-legacy-import-template.xlsx"',
    },
  });
}
