import { describe, it, expect, vi, afterEach } from 'vitest';
import { GoogleTranslateProvider } from './GoogleTranslateProvider';

function mockJsonResponse(init: { ok: boolean; status?: number; body?: unknown; textBody?: string }) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    json: async () => init.body,
    text: async () => init.textBody ?? '',
  } as unknown as Response;
}

describe('GoogleTranslateProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the translated text on a successful API call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({ ok: true, body: { data: { translations: [{ translatedText: 'Fuel tank cap is deformed.' }] } } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GoogleTranslateProvider('fake-api-key');
    const result = await provider.translate({ text: 'ฝาถังน้ำมันยุบตัว', sourceLang: 'th', targetLang: 'en' });

    expect(result).toEqual({ ok: true, text: 'Fuel tank cap is deformed.' });
    // The API key is passed as a query param, never logged/exposed elsewhere.
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('key=fake-api-key');
    const calledBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(calledBody).toEqual({ q: 'ฝาถังน้ำมันยุบตัว', source: 'th', target: 'en', format: 'text' });
  });

  it('never throws on an API error response - returns a structured failure with the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({ ok: false, status: 403, textBody: 'API key invalid' })));

    const provider = new GoogleTranslateProvider('bad-key');
    const result = await provider.translate({ text: 'ทดสอบ', sourceLang: 'th', targetLang: 'en' });

    expect(result).toEqual({ ok: false, reason: 'Google Translate API error (HTTP 403)' });
  });

  it('never throws when the response has an unexpected shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({ ok: true, body: { unexpected: 'shape' } })));

    const provider = new GoogleTranslateProvider('fake-api-key');
    const result = await provider.translate({ text: 'ทดสอบ', sourceLang: 'th', targetLang: 'en' });

    expect(result.ok).toBe(false);
  });

  it('never throws when fetch itself rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const provider = new GoogleTranslateProvider('fake-api-key');
    const result = await provider.translate({ text: 'ทดสอบ', sourceLang: 'th', targetLang: 'en' });

    expect(result).toEqual({ ok: false, reason: 'Translation request failed' });
  });
});
