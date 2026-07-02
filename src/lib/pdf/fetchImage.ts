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
 * already-resolved base64 data: URI instead. A failed fetch degrades to
 * `null` (the caller renders a "failed to load" placeholder) rather than
 * crashing the export. Shared by every PDF document that embeds a
 * Drive-hosted photo (MQR, PM).
 */
export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return null;
      return `data:${contentType};base64,${buf.toString('base64')}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
