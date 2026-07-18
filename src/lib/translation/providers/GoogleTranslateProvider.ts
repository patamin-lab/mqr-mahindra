import { MachineTranslationProvider, TranslationRequest, TranslationResult } from '../types';

const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Google Cloud Translation (v2, API-key auth) - the provider selected for
 * this release. Plain `fetch()` against the REST endpoint, same
 * discipline `fetchImage.ts` already uses elsewhere in this PDF pipeline
 * (timeout via AbortController, never let a network failure throw past
 * this class) - deliberately not the `googleapis` SDK already in this
 * repo's dependencies, since that SDK targets OAuth2-authenticated APIs
 * (Drive) and would be a heavier, unnecessary dependency for this single
 * API-key-authenticated REST call.
 *
 * The API key itself is never hardcoded or entered here - it's read from
 * `GOOGLE_TRANSLATE_API_KEY` by `createMachineTranslationProvider()`
 * (factory.ts), which is the only place environment configuration is
 * read. Provisioning the actual key in Vercel/`.env.local` is an
 * operational step for whoever owns that credential, not something this
 * change does.
 */
export class GoogleTranslateProvider implements MachineTranslationProvider {
  readonly name = 'Google Cloud Translation';

  constructor(private readonly apiKey: string) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: request.text,
          source: request.sourceLang,
          target: request.targetLang,
          // 'text' (not 'html') - a plain free-text field, never
          // interpreted/escaped as markup.
          format: 'text',
        }),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === 'AbortError' ? 'Translation request timed out' : 'Translation request failed';
      console.error(`GoogleTranslateProvider: ${reason}`, err);
      return { ok: false, reason };
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('GoogleTranslateProvider: API error', { status: res.status, body });
      return { ok: false, reason: `Google Translate API error (HTTP ${res.status})` };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      console.error('GoogleTranslateProvider: response was not valid JSON', err);
      return { ok: false, reason: 'Invalid response from Google Translate' };
    }

    const translatedText = (json as { data?: { translations?: { translatedText?: unknown }[] } })?.data?.translations?.[0]?.translatedText;
    if (typeof translatedText !== 'string') {
      console.error('GoogleTranslateProvider: unexpected response shape', json);
      return { ok: false, reason: 'Unexpected response from Google Translate' };
    }

    return { ok: true, text: translatedText };
  }
}
