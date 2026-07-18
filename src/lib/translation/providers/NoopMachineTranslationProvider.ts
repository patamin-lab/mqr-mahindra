import { MachineTranslationProvider, TranslationRequest, TranslationResult } from '../types';

/**
 * Default provider - no real machine-translation backend is configured
 * yet. Deliberately honest rather than fabricated: this codebase has no
 * Google Translate/DeepL/Azure AI Translator/OpenAI credential to call
 * (provisioning one, choosing a vendor, and budget approval are product
 * decisions outside this change), and this project's own security rules
 * forbid entering API credentials into code/commands. Always resolves to
 * `{ ok: false }`, which `TranslationService` turns into exactly the
 * documented fallback UX ("EN: Translation unavailable") - the same
 * outcome a real provider's transient failure would produce, so nothing
 * downstream needs to know the difference.
 *
 * Swap this for a real provider by implementing `MachineTranslationProvider`
 * (e.g. `GoogleTranslateProvider`, `DeepLProvider`) and passing it to
 * `new TranslationService(provider)` instead - no other code changes.
 */
export class NoopMachineTranslationProvider implements MachineTranslationProvider {
  readonly name = 'No-op (no provider configured)';

  async translate(_request: TranslationRequest): Promise<TranslationResult> {
    return { ok: false, reason: 'No machine translation provider is configured' };
  }
}
