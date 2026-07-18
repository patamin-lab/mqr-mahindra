/**
 * react-pdf's <Image src={remoteUrl}> fetches the URL itself at render
 * time, with no control over headers/timeout/retries and no way to
 * substitute a placeholder on failure - one bad fetch throws and takes
 * down the whole PDF (this is what caused MQR's export 500 after
 * switching photo URLs to Drive's `thumbnail?id=...` endpoint, which -
 * unlike a normal <img> tag in a browser - can reject a plain server-side
 * fetch with no browser-like User-Agent/Accept headers).
 *
 * To make this robust, every photo is fetched up front (with a timeout, a
 * normal browser UA, and a try/catch) and handed to react-pdf as an
 * already-resolved base64 data: URI instead. Shared by every PDF document
 * in the app (MQR, PM, NTR).
 *
 * Defect 1 fix: a failed fetch used to collapse to a bare `null`, with the
 * actual HTTP status/content-type/error swallowed - "never silently skip
 * an image" means every failure needs a traceable reason. Every branch
 * below logs the full diagnostic (URL, HTTP status, content-type, byte
 * size, the specific failure) server-side for root-cause tracing, and
 * returns a short, human-readable reason the PDF's own placeholder can
 * show - concise and professional (this is an official cross-country
 * engineering report), not a raw signed URL or stack trace dumped onto
 * the page.
 */
export type ImageFetchResult = { ok: true; dataUri: string } | { ok: false; reason: string };

export async function fetchImageAsDataUri(url: string): Promise<ImageFetchResult> {
  const fail = (reason: string, detail: unknown): ImageFetchResult => {
    console.error(`PDF image fetch failed: ${reason}`, { url, detail });
    return { ok: false, reason };
  };

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return fail('Request timed out', err);
    }
    return fail('Network error', err);
  }

  if (!res.ok) {
    // The single most common real-world case: an expired signed URL
    // returns 403 (Supabase) or 401/400 (other providers) - surfaced
    // distinctly so "expired link" is diagnosable at a glance in logs,
    // not lumped in with every other HTTP failure.
    const reason = res.status === 401 || res.status === 403 ? 'Image link expired' : `HTTP ${res.status}`;
    return fail(reason, { status: res.status, statusText: res.statusText });
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    return fail('Unexpected content type', { contentType });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) {
    return fail('Empty response body', { contentType });
  }

  return { ok: true, dataUri: `data:${contentType};base64,${buf.toString('base64')}` };
}

/**
 * Resolves a list of image URLs in parallel and returns them keyed by
 * their original URL - the shape every PDF renderer's photo grid needs
 * (`photoDataUris.get(item.url)`). Extracted so MQR/PM/NTR share the exact
 * same resolution + Map-building step instead of three copies of the
 * same `Promise.all(urls.map(fetchImageAsDataUri))`.
 */
export async function resolveImageDataUris(urls: string[]): Promise<Map<string, ImageFetchResult>> {
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}
