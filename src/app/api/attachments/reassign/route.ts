import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError, canAccessAttachment } from '@/shared/attachments';

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
  if (ids.length === 0) return NextResponse.json({ ok: true });

  try {
    // The target must be a record `session` can actually access - this is
    // always true for the legitimate flow (re-tagging onto a record the
    // caller just created), and blocks a crafted request from re-tagging
    // another dealer's attachments onto/off of a record outside the
    // caller's scope. Every id in `ids` shares one upload session, so the
    // first attachment's module stands in for the whole batch.
    const first = await attachmentService.getById(ids[0]);
    if (!first) return forbiddenError();
    if (!(await canAccessAttachment({ module: first.module, entityId }, session))) return forbiddenError();

    await attachmentService.reassignEntity(ids, entityId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 500 });
  }
}
