import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, AttachmentType, toUserFacingAttachmentError } from '@/shared/attachments';

const attachmentService = new AttachmentService();

/** Step 1 for a large (>4MB) attachment - returns a Supabase Storage
 *  signed upload URL the browser PUTs bytes to directly, bypassing our
 *  own API route entirely (same reason `/api/upload/init` existed for
 *  Google Drive's resumable session). See `SupabaseStorageProvider.createSignedUploadUrl()`. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const body = await req.json().catch(() => null);
  const { module: moduleName, entityType, entityId, attachmentType, filename, mimeType } = body ?? {};
  if (!moduleName || !entityType || !entityId || !attachmentType || !filename || !mimeType) {
    return NextResponse.json({ ok: false, error: 'Invalid direct-upload request' }, { status: 400 });
  }

  try {
    const result = await attachmentService.initDirectUpload({
      module: moduleName,
      entityType,
      entityId,
      attachmentType: attachmentType as AttachmentType,
      filename,
      mimeType,
      createdBy: session.username,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 500 });
  }
}
