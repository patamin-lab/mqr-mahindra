import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Step "1.5" of the large-file ("video" / oversized photo) upload path -
 * the fallback for browsers that cannot PUT straight to Google's resumable
 * session URL. Confirmed live (2026-06-25): a direct cross-origin browser
 * PUT from this app's own origin to www.googleapis.com always fails with a
 * generic "TypeError: Failed to fetch" before any bytes are sent - Drive's
 * resumable upload endpoint does not return CORS headers, so the browser
 * blocks the request outright even though /api/upload/init had just
 * successfully created the session.
 *
 * /api/upload/init still opens the Drive session the same way it always
 * did (server-side, with our Google credentials). The browser now sends
 * the file in <=4MiB chunks to this same-origin route instead (see
 * report-form.tsx's putFileViaServerRelay), and *we* relay each chunk to
 * Google server-to-server, where CORS does not apply. Each leg of every
 * chunk - client -> us, and us -> Google - stays safely under Vercel's
 * hard 4.5MB serverless body cap by construction.
 */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const sessionUrl = req.headers.get('x-drive-session-url') ?? '';
  const start = Number(req.headers.get('x-chunk-start'));
  const total = Number(req.headers.get('x-total-size'));

  // Only ever relay to the exact Drive upload endpoint we ourselves handed
  // the client in /api/upload/init's response - never an arbitrary
  // caller-supplied host - so an authenticated user can't turn this route
  // into a server-side-request-forgery proxy to other hosts.
  if (!sessionUrl.startsWith('https://www.googleapis.com/upload/drive/')) {
    return NextResponse.json({ ok: false, error: 'sessionUrl ไม่ถูกต้อง' }, { status: 400 });
  }
  if (!Number.isFinite(start) || start < 0 || !Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ ok: false, error: 'ข้อมูล chunk ไม่ถูกต้อง' }, { status: 400 });
  }

  const chunk = Buffer.from(await req.arrayBuffer());
  if (chunk.length === 0) {
    return NextResponse.json({ ok: false, error: 'chunk ว่าง' }, { status: 400 });
  }
  const end = start + chunk.length - 1;

  let driveRes: Response;
  try {
    driveRes = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(chunk.length),
        'Content-Range': `bytes ${start}-${end}/${total}`,
      },
      body: chunk,
    });
  } catch (err: any) {
    console.error('upload chunk relay error', err);
    return NextResponse.json(
      { ok: false, error: 'ส่งข้อมูลไปยัง Google Drive ไม่สำเร็จ' },
      { status: 502 }
    );
  }

  // Drive answers every intermediate chunk with 308 (Resume Incomplete);
  // the chunk that completes the file gets back 200/201 with the file's
  // JSON metadata.
  if (driveRes.status === 308) {
    return NextResponse.json({ ok: true, done: false });
  }
  if (driveRes.ok) {
    const fileJson = await driveRes.json();
    if (!fileJson?.id) {
      return NextResponse.json(
        { ok: false, error: 'ไม่ได้รับ file ID จาก Google Drive' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, done: true, fileId: fileJson.id as string });
  }

  const errText = await driveRes.text().catch(() => '');
  console.error('drive rejected chunk', driveRes.status, errText);
  return NextResponse.json(
    { ok: false, error: `Google Drive ปฏิเสธข้อมูล (${driveRes.status})` },
    { status: 502 }
  );
}
