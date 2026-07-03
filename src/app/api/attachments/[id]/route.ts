import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError } from '@/shared/attachments';

const attachmentService = new AttachmentService();

interface RouteParams {
  params: { id: string };
}

/** A fresh, on-demand display URL - `AttachmentViewer`'s "Preview"/"Open"/
 *  "Download" actions call this rather than relying on a possibly-stale
 *  URL from an earlier list response (a Supabase signed URL expires after
 *  an hour). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    const resolved = await attachmentService.getUrl(params.id);
    if (!resolved) return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(new Error('not found'), 'access') }, { status: 404 });
    return NextResponse.json({ ok: true, ...resolved });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'access') }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    await attachmentService.delete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'delete') }, { status: 500 });
  }
}
