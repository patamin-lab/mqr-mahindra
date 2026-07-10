import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../userAgentParser';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';

describe('parseUserAgent', () => {
  it('identifies Chrome on Windows as Desktop', () => {
    expect(parseUserAgent(CHROME_WINDOWS)).toEqual({ deviceName: 'Desktop', browser: 'Chrome', os: 'Windows' });
  });

  it('identifies Safari on macOS as Desktop', () => {
    expect(parseUserAgent(SAFARI_MAC)).toEqual({ deviceName: 'Desktop', browser: 'Safari', os: 'macOS' });
  });

  it('identifies Safari on iPhone as Mobile/iOS', () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ deviceName: 'Mobile', browser: 'Safari', os: 'iOS' });
  });

  it('identifies Chrome on Android as Mobile', () => {
    expect(parseUserAgent(CHROME_ANDROID)).toEqual({ deviceName: 'Mobile', browser: 'Chrome', os: 'Android' });
  });

  it('identifies Firefox on Linux', () => {
    expect(parseUserAgent(FIREFOX_LINUX)).toEqual({ deviceName: 'Desktop', browser: 'Firefox', os: 'Linux' });
  });

  it('identifies Edge (not generic Chrome) even though its UA also contains "Chrome/"', () => {
    expect(parseUserAgent(EDGE_WINDOWS).browser).toBe('Edge');
  });

  it('falls back to "Unknown" for an empty/missing user agent, never throws', () => {
    expect(parseUserAgent(null)).toEqual({ deviceName: 'Unknown device', browser: 'Unknown browser', os: 'Unknown OS' });
    expect(parseUserAgent(undefined)).toEqual({ deviceName: 'Unknown device', browser: 'Unknown browser', os: 'Unknown OS' });
    expect(parseUserAgent('')).toEqual({ deviceName: 'Unknown device', browser: 'Unknown browser', os: 'Unknown OS' });
  });

  it('falls back to "Unknown" for a garbage string rather than guessing', () => {
    expect(parseUserAgent('some-random-bot/1.0')).toEqual({ deviceName: 'Desktop', browser: 'Unknown browser', os: 'Unknown OS' });
  });
});
