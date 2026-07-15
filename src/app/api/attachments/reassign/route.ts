import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError } from '@/shared/attachments';

const attachmentService = new AttachmentService();

/** Re-tags attachments uploaded against a temporary, client-generated
 *  entity ID with a business record's real ID once it's saved - the
 *  Attachment Platform's equivalent of the old `relocatePendingFiles()`
 *  call every create-record route used to make. See
 *  `AttachmentService.reassignEntity()`. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const body = await req.json().catch(() => null);
  const ids = body?.ids as string[] | undefined;
  const entityId = body?.entityId as string | undefined;
  if (!Array.isArray(ids) || !entityId) {
    return NextResponse.json({ ok: false, error: 'ids and entityId are required' }, { status: 400 });
  }

  try {
    await attachmentService.reassignEntity(ids, entityId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 500 });
  }
}
