import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
// @ts-ignore - fontkit ships no TypeScript declarations for this entry point
import * as fontkit from 'fontkit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const urlOrigin = new URL(req.url).origin;
  const headerProto = req.headers.get('x-forwarded-proto') ?? 'http';
  const headerHost = req.headers.get('host');
  const headerOrigin = `${headerProto}://${headerHost}`;

  const results: Record<string, any> = { urlOrigin, headerOrigin };

  for (const [label, base] of Object.entries({ urlOrigin, headerOrigin })) {
    for (const file of ['Sarabun-Regular.ttf', 'Sarabun-Bold.ttf']) {
      const key = `${label}__${file}`;
      const fontUrl = `${base}/fonts/${file}`;
      try {
        const res = await fetch(fontUrl);
        const buf = new Uint8Array(await res.arrayBuffer());
        const entry: Record<string, any> = {
          fontUrl,
          status: res.status,
          ok: res.ok,
          redirected: res.redirected,
          finalUrl: res.url,
          contentType: res.headers.get('content-type'),
          contentLength: res.headers.get('content-length'),
          byteLength: buf.length,
          first16: Array.from(buf.slice(0, 16)),
        };
        try {
          const font = fontkit.create(buf as any);
          entry.fontkitOk = true;
          entry.fontkitType = (font as any)?.type ?? typeof font;
        } catch (fkErr: any) {
          entry.fontkitOk = false;
          entry.fontkitError = fkErr?.message ?? String(fkErr);
          entry.fontkitStack = fkErr?.stack ?? null;
        }
        results[key] = entry;
      } catch (err: any) {
        results[key] = { fontUrl, fetchError: err?.message ?? String(err) };
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
