import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError, canAccessAttachment } from '@/shared/attachments';

const attachmentService = new AttachmentService();

interface RouteParams {
  params: { id: string };
}

const notFound = () =>
  NextResponse.json({ ok: false, error: toUserFacingAttachmentError(new Error('not found'), 'access') }, { status: 404 });

/** A fresh, on-demand display URL - the shared image platform's "Preview"/"Open"/
 *  "Download" actions call this rather than relying on a possibly-stale
 *  URL from an earlier list response (a Supabase signed URL expires after
 *  an hour). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  try {
    const attachment = await attachmentService.getById(params.id);
    if (!attachment) return notFound();
    if (!(await canAccessAttachment(attachment, session))) return notFound();

    const resolved = await attachmentService.getUrl(params.id);
    if (!resolved) return notFound();
    return NextResponse.json({ ok: true, ...resolved });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'access') }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  try {
    const attachment = await attachmentService.getById(params.id);
    if (!attachment) return notFound();
    if (!(await canAccessAttachment(attachment, session))) return notFound();

    await attachmentService.delete(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'delete') }, { status: 500 });
  }
}
