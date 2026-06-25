import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { finalizeResumableUpload } from '@/lib/googleDrive';

/**
 * Step 2 of the "large file" upload path (see /api/upload/init). After the
 * browser has PUT the file bytes straight to the Drive resumable session
 * URL and gotten a file ID back from Google, this sets the "anyone with
 * the link can view" permission - which needs our server's Google
 * credentials - and returns the same `{ ok, url }` shape /api/upload does,
 * so the client treats both upload paths identically.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const fileId = String(body.fileId ?? '').trim();
    const mimeType = String(body.mimeType ?? 'application/octet-stream');
    if (!fileId) {
      return NextResponse.json({ ok: false, error: 'ไม่พบ fileId' }, { status: 400 });
    }

    const { url } = await finalizeResumableUpload(fileId, mimeType);
    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error('upload finalize error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'จบการอัปโหลดไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
