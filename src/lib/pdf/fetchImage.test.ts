import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchImageAsDataUri } from './fetchImage';

function mockResponse(init: { ok: boolean; status?: number; statusText?: string; contentType?: string; body?: ArrayBuffer }) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.statusText ?? '',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? init.contentType ?? null : null) },
    arrayBuffer: async () => init.body ?? new ArrayBuffer(0),
  } as unknown as Response;
}

describe('fetchImageAsDataUri - Defect 1 diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a data URI on a successful image fetch', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: true, contentType: 'image/jpeg', body: bytes })));

    const result = await fetchImageAsDataUri('https://example.com/photo.jpg');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataUri.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('reports "Image link expired" specifically for a 403 (expired signed URL) - never a silent null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 403, statusText: 'Forbidden' })));

    const result = await fetchImageAsDataUri('https://example.com/expired-signature.jpg');
    expect(result).toEqual({ ok: false, reason: 'Image link expired' });
  });

  it('reports "Image link expired" for a 401 too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 401 })));

    const result = await fetchImageAsDataUri('https://example.com/expired.jpg');
    expect(result).toEqual({ ok: false, reason: 'Image link expired' });
  });

  it('reports the raw HTTP status for a non-auth failure (e.g. 404/500)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 404 })));

    const result = await fetchImageAsDataUri('https://example.com/missing.jpg');
    expect(result).toEqual({ ok: false, reason: 'HTTP 404' });
  });

  it('reports "Unexpected content type" when the response is not an image (e.g. an HTML error page)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: true, contentType: 'text/html' })));

    const result = await fetchImageAsDataUri('https://example.com/not-an-image');
    expect(result).toEqual({ ok: false, reason: 'Unexpected content type' });
  });

  it('reports "Empty response body" for a zero-byte successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: true, contentType: 'image/jpeg', body: new ArrayBuffer(0) })));

    const result = await fetchImageAsDataUri('https://example.com/empty.jpg');
    expect(result).toEqual({ ok: false, reason: 'Empty response body' });
  });

  it('reports "Network error" when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS resolution failed')));

    const result = await fetchImageAsDataUri('https://unreachable.example.com/photo.jpg');
    expect(result).toEqual({ ok: false, reason: 'Network error' });
  });
});
