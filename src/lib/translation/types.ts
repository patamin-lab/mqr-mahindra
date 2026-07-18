/**
 * Corporate PDF Standardization - Defect 2 (bilingual TH/EN free text).
 *
 * The PDF renderer must never perform translation directly - it depends
 * only on this interface. `TranslationService` (translationService.ts)
 * is the one thing the PDF layer calls; `MachineTranslationProvider` is
 * the swappable backend `TranslationService` delegates to. Adding a real
 * vendor (Google Translate/DeepL/Azure AI Translator/OpenAI) later means
 * writing one new class that implements this interface - zero changes
 * anywhere else.
 */
export interface TranslationRequest {
  text: string;
  sourceLang: 'th';
  targetLang: 'en';
}

export type TranslationResult = { ok: true; text: string } | { ok: false; reason: string };

export interface MachineTranslationProvider {
  /** Human-readable name for logging/diagnostics (e.g. "Google Translate", "No-op"). */
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
