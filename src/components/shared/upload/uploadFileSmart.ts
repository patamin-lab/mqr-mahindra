import { fetchJson, FetchJsonError } from '@/lib/fetchJson';

// Vercel hard-caps a serverless function's request body at 4.5MB
// (platform-level, can't be raised). Any photo/video under this stays
// safely under that cap when proxied through /api/upload; anything bigger
// (most videos, occasionally a very high-res photo) instead goes through
// the Google Drive resumable-upload path via putFileViaServerRelay() below,
// in <=4MiB chunks, so no single request - in either direction - ever
// touches our function's body limit. See uploadFileSmart() below.
const PROXY_SAFE_BYTES = 4 * 1024 * 1024;

// Drive's resumable upload protocol requires every chunk except the last
// to be a multiple of 256 KiB. 4 MiB satisfies that and keeps each relayed
// chunk safely under Vercel's 4.5MB cap on both legs (browser -> us, and
// us -> Google).
const CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * Sends a file to a Google Drive resumable upload session in <=4MiB
 * chunks, relayed through our own same-origin /api/upload/chunk route,
 * reporting progress via `onProgress`. Returns the new file's Drive ID.
 *
 * Drive's resumable session URL does not send CORS headers, so a direct
 * browser PUT to www.googleapis.com fails before any bytes are sent -
 * confirmed live (2026-06-25): every attempt threw a generic
 * "TypeError: Failed to fetch", even though /api/upload/init had just
 * successfully created the session. Relaying each chunk through our own
 * server avoids the cross-origin call entirely (the browser only ever
 * talks to our own origin); our server then forwards each chunk to Google
 * server-to-server, where CORS does not apply.
 */
async function putFileViaServerRelay(sessionUrl: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    const chunk = file.slice(offset, end);

    let attempt = 0;
    let result: { ok: boolean; done?: boolean; fileId?: string; error?: string } | null = null;
    while (attempt < 3) {
      attempt += 1;
      try {
        result = await fetchJson<{
          ok: boolean;
          done?: boolean;
          fileId?: string;
          error?: string;
        }>('/api/upload/chunk', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Drive-Session-Url': sessionUrl,
            'X-Chunk-Start': String(offset),
            'X-Total-Size': String(file.size),
          },
          body: chunk,
        });
        break;
      } catch (err: any) {
        if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') throw err;
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    if (!result) throw new Error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่');

    offset = end;
    if (onProgress) onProgress(Math.round((offset / file.size) * 100));

    if (result.done) {
      if (!result.fileId) throw new Error('ไม่ได้รับ file ID จาก Google Drive');
      return result.fileId;
    }
  }
  throw new Error('อัปโหลดไม่สมบูรณ์ กรุณาลองใหม่');
}

/**
 * Shared upload entry point for every form in the app that attaches a
 * file to a Google Drive folder (MQR's report/update forms today; any
 * future module reaches for this instead of re-implementing the
 * size-routing). Small files (most photos): proxy through our own
 * /api/upload, which also handles HEIC->JPEG conversion server-side.
 * Large files (videos, occasionally an oversized photo): relayed to
 * Google Drive in chunks via putFileViaServerRelay() so the bytes never
 * have to pass through our own Vercel function in one piece - and never
 * get capped by it - while still never leaving our own origin from the
 * browser's point of view. Either path resolves to the same Drive URL
 * string.
 */
export async function uploadFileSmart(
  file: File,
  label: string,
  dealerId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  try {
    if (file.size > PROXY_SAFE_BYTES) {
      const init = await fetchJson<{ sessionUrl: string }>('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          dealerId,
        }),
      });
      const fileId = await putFileViaServerRelay(init.sessionUrl, file, onProgress);
      const final = await fetchJson<{ url: string }>('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, mimeType: file.type || 'application/octet-stream' }),
      });
      return final.url;
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('label', label);
    fd.append('dealerId', dealerId);
    const json = await fetchJson<{ url: string }>('/api/upload', { method: 'POST', body: fd });
    return json.url;
  } catch (err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') throw err;
    throw new Error(`อัปโหลด${label}ไม่สำเร็จ: ${err?.message ?? 'เกิดข้อผิดพลาด'}`);
  }
}
