import path from 'path';
import { Font } from '@react-pdf/renderer';

let fontsRegistered = false;
let thaiShapingConfigured = false;

type FontkitLayoutResult = {
  glyphs: Array<{ codePoints: number[] }>;
  positions: Array<{ xAdvance: number }>;
};

type FontkitLayout = (
  text: string,
  features?: Record<string, boolean> | string[],
  script?: string,
  language?: string,
  direction?: string,
) => FontkitLayoutResult;

type FontkitFont = {
  familyName?: string;
  layout: FontkitLayout;
};

/**
 * `fontkit` applies its Thai `ccmp` substitution before react-pdf writes the
 * PDF ToUnicode map. That splits Sara Am (ำ) into two glyphs and can combine
 * it with a preceding tone mark. The PDF remains visually plausible, but its
 * Unicode text gains/drops characters (for example, น้ำมัน or อำเภอ).
 *
 * Disable only that substitution for Sarabun in server-side PDF rendering.
 * The font's mark and mkmk positioning remain enabled, so Thai diacritics
 * retain their normal visual placement while each source character maps to
 * exactly one extractable Unicode character. A one-unit advance for each
 * zero-width Thai combining mark also prevents PDF readers from sorting a
 * mark and the following glyph at the same x-position during layout-based
 * text extraction. One Sarabun unit is 1/1000 em and is visually invisible.
 */
function configureThaiPdfShaping(fontPath: string): void {
  if (thaiShapingConfigured) return;

  // fontkit is a transitive dependency of @react-pdf/font. Requiring its
  // deduplicated Node instance patches the same font prototype react-pdf uses.
  // It has no published TypeScript declarations.
  const fontkit = require('fontkit') as { openSync: (source: string) => FontkitFont };
  const probe = fontkit.openSync(fontPath);
  const prototype = Object.getPrototypeOf(probe) as { layout: FontkitLayout };
  const originalLayout = prototype.layout;

  prototype.layout = function layoutThaiPdfText(
    this: FontkitFont,
    text: string,
    features?: Record<string, boolean> | string[],
    script?: string,
    language?: string,
    direction?: string,
  ) {
    const shouldDisableComposition =
      this.familyName === 'Sarabun' &&
      typeof text === 'string' &&
      /[\u0E00-\u0E7F]/.test(text) &&
      !Array.isArray(features);

    const layout = originalLayout.call(
      this,
      text,
      shouldDisableComposition ? { ...(features ?? {}), ccmp: false } : features,
      script,
      language,
      direction,
    );

    if (shouldDisableComposition) {
      for (let index = 0; index < layout.glyphs.length; index += 1) {
        const glyph = layout.glyphs[index];
        const position = layout.positions[index];
        const isThaiCombiningMark = glyph.codePoints.some(
          (codePoint) =>
            (codePoint >= 0x0e31 && codePoint <= 0x0e3a) ||
            (codePoint >= 0x0e47 && codePoint <= 0x0e4e),
        );

        if (isThaiCombiningMark && position?.xAdvance === 0) {
          position.xAdvance = 1;
        }
      }
    }

    return layout;
  };

  thaiShapingConfigured = true;
}

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
  configureThaiPdfShaping(path.join(fontsDir, 'Sarabun-Regular.ttf'));
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: path.join(fontsDir, 'Sarabun-Regular.ttf'), fontWeight: 'normal' },
      { src: path.join(fontsDir, 'Sarabun-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  fontsRegistered = true;
}
