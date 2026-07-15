import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError } from '@/shared/attachments';

const attachmentService = new AttachmentService();

/** Step 2 for a large attachment - called once the browser's direct PUT
 *  to the signed URL reports success. Confirms the object actually exists
 *  in storage before anything trusts it (never takes the client's word
 *  alone) and resolves a display URL for the caller. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const body = await req.json().catch(() => null);
  const attachmentId = body?.attachmentId as string | undefined;
  if (!attachmentId) return NextResponse.json({ ok: false, error: 'attachmentId is required' }, { status: 400 });

  try {
    const attachment = await attachmentService.finalizeDirectUpload(attachmentId);
    const resolved = await attachmentService.getUrl(attachment.id);
    return NextResponse.json({ ok: true, attachment, url: resolved?.url ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 500 });
  }
}
