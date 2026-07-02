import path from 'path';
import { Font } from '@react-pdf/renderer';

let fontsRegistered = false;

/**
 * Fonts are loaded from an on-disk path instead of being fetched over HTTP.
 * We previously registered them with an absolute URL
 * (`${baseUrl}/fonts/*.ttf`) for react-pdf to fetch at render time, but
 * that self-fetch happens server-side, with no browser session attached -
 * and this Vercel project has Deployment Protection enabled, which
 * intercepts ANY unauthenticated request to the deployment, including the
 * app's own outbound fetch back to itself, and returns the Vercel SSO
 * login page instead of the font file. fontkit then tried to parse that
 * login page's HTML as a font and threw "Unknown font format" - on every
 * single export, for both the original WOFF files and the TTF files they
 * were converted to, regardless of how `baseUrl`/origin was derived.
 * (Confirmed via a temporary debug route that fetched the exact same URL
 * server-side and logged the response: status 200, but the body was the
 * Vercel SSO HTML page, not font bytes.)
 *
 * Passing the absolute file path as `src` sidesteps HTTP - and Deployment
 * Protection - entirely: @react-pdf/font's FontSource._load() falls through
 * to `fontkit.open(src, postscriptName)` for any src string that isn't one
 * of the standard font names, a data: URL, or an http(s) URL, and
 * fontkit.open() reads the file from disk itself.
 *
 * (We first tried passing a `Buffer` read via `fs.readFileSync` directly as
 * `src`, which satisfies react-pdf's runtime font-loading code in some
 * other contexts, but this version's `isDataUrl(this.src)` helper
 * unconditionally calls `this.src.indexOf(',')` then `.substring(...)` on
 * it - Buffer has `.indexOf` (byte search) but not `.substring`, so it blew
 * up with "dataUrl.substring is not a function" as soon as a 0x2C byte
 * appeared anywhere in the font's binary data. A plain path string avoids
 * that branch entirely.)
 *
 * For this to work inside the Vercel serverless function, the files under
 * /public/fonts must be explicitly included in the function's file trace
 * (see `outputFileTracingIncludes` in next.config.mjs) - by default Next
 * does not bundle /public into serverless functions, since it's normally
 * served separately via the CDN.
 *
 * Shared by every PDF document in the app (MQR, PM, and any future
 * module) - registering the same font family twice is harmless
 * (react-pdf just overwrites the same registration), but there's no
 * reason for each module to duplicate this logic.
 */
export function ensureFontsRegistered() {
  if (fontsRegistered) return;
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: path.join(fontsDir, 'Sarabun-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(fontsDir, 'Sarabun-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  fontsRegistered = true;
}
