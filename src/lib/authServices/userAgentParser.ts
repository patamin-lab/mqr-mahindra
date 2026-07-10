/**
 * Dependency-free User-Agent parser — device/browser/OS labels for the
 * Active Sessions list (Authentication Platform v3.0). Deliberately a
 * small hand-rolled regex parser rather than a library (`ua-parser-js`
 * etc.) per this repo's "no new dependency casually" convention
 * (`.claude/rules/02-coding-standards.md`). Covers the common desktop/
 * mobile browsers and OSes; falls back to "Unknown" rather than throwing
 * or guessing on anything it doesn't recognize.
 */
export interface ParsedUserAgent {
  deviceName: string;
  browser: string;
  os: string;
}

function matchBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/CriOS\//.test(ua)) return 'Chrome (iOS)';
  if (/FxiOS\//.test(ua)) return 'Firefox (iOS)';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Version\/.*Safari\//.test(ua)) return 'Safari';
  if (/MSIE |Trident\//.test(ua)) return 'Internet Explorer';
  return 'Unknown browser';
}

function matchOS(ua: string): string {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function matchDeviceName(ua: string): string {
  if (/iPad|Tablet/.test(ua)) return 'Tablet';
  if (/iPhone|Android.*Mobile|Mobile.*Android/.test(ua)) return 'Mobile';
  return 'Desktop';
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent ?? '';
  if (!ua.trim()) {
    return { deviceName: 'Unknown device', browser: 'Unknown browser', os: 'Unknown OS' };
  }
  return {
    deviceName: matchDeviceName(ua),
    browser: matchBrowser(ua),
    os: matchOS(ua),
  };
}
