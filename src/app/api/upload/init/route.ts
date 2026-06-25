import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDealer } from '@/lib/db';
import { initResumableUpload } from '@/lib/googleDrive';

/**
 * Step 1 of the "large file" upload path. Vercel hard-caps a serverless
 * function's request body at 4.5MB (platform-level, can't be raised), so
 * any photo/video bigger than that can never be proxied through
 * /api/upload directly - it gets rejected by Vercel's edge layer before
 * our code even runs, and the client sees a non-JSON error response.
 *
 * This route never receives the file's bytes - only its name/type/size -
 * so it's always tiny. It opens a Google Drive resumable upload session
 * (using our server-side OAuth2 credentials) and hands back the bare
 * session URL. The browser then PUTs the actual file straight to Google,
 * bypassing our Vercel function entirely. See report-form.tsx's
 * `uploadOne` for the client side of this flow.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const filename = String(body.filename ?? '').trim();
    const mimeType = String(body.mimeType ?? 'application/octet-stream');
    const dealerId = String(body.dealerId ?? '').trim();
    const jobId = body.jobId ? String(body.jobId).trim() : undefined;

    if (!filename) {
      return NextResponse.json({ ok: false, error: 'ไม่พบชื่อไฟล์' }, { status: 400 });
    }

    let dealerFolderName = 'na';
    if (dealerId) {
      const dealer = await getDealer(dealerId);
      dealerFolderName = (dealer?.short_name || dealerId).replace(/[^a-zA-Z0-9ก-๙_-]/g, '');
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`.replace(
      /[\\/]/g,
      '_'
    );

    const { sessionUrl } = await initResumableUpload({
      filename: safeName,
      mimeType,
      dealerFolderName,
      jobId,
    });

    return NextResponse.json({ ok: true, sessionUrl });
  } catch (err: any) {
    console.error('upload init error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'เริ่มอัปโหลดไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
