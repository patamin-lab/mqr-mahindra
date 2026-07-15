import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, toUserFacingAttachmentError } from '@/shared/attachments';

const attachmentService = new AttachmentService();

interface RouteParams {
  params: { id: string };
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  try {
    const attachment = await attachmentService.restore(params.id);
    return NextResponse.json({ ok: true, attachment });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'restore') }, { status: 500 });
  }
}
