import { MachineTranslationProvider, TranslationResult } from './types';
import { NoopMachineTranslationProvider } from './providers/NoopMachineTranslationProvider';
import { applyTerminologyNormalization, protectAcronyms } from './terminologyDictionary';
import { normalizeUnits, normalizeWhitespaceAndLists } from './textNormalization';

/**
 * The one thing the PDF layer (or any future caller) depends on - never a
 * specific vendor, never `MachineTranslationProvider` directly.
 *
 * Pipeline order matters and is deliberate: normalize whitespace ->
 * substitute known engineering terminology/units directly in the THAI
 * SOURCE -> protect acronyms with placeholders -> provider.translate()
 * -> restore acronym placeholders. Terminology/units are applied BEFORE
 * the provider call, not after - a real provider (Google Cloud
 * Translation) returns fully English text with no Thai substrings left
 * to match, so post-processing its output could never find anything to
 * fix. Pre-substituting means the approved English term is what actually
 * reaches the provider (which passes an already-correct short technical
 * phrase through largely unchanged), rather than whatever a general-
 * purpose model would have produced on its own.
 *
 * Translation failure NEVER throws - every path returns a
 * `TranslationResult`, so a PDF's generation can never be blocked by a
 * translation problem (Defect 2's own explicit requirement).
 */
export class TranslationService {
  constructor(private readonly provider: MachineTranslationProvider = new NoopMachineTranslationProvider()) {}

  async translateToEnglish(thaiText: string | null | undefined): Promise<TranslationResult> {
    const trimmed = (thaiText ?? '').trim();
    if (!trimmed) return { ok: true, text: '' };

    const cleaned = normalizeWhitespaceAndLists(trimmed);
    const withTerminology = applyTerminologyNormalization(cleaned);
    const withUnits = normalizeUnits(withTerminology);
    const { text: protectedText, restore } = protectAcronyms(withUnits);

    let result: TranslationResult;
    try {
      result = await this.provider.translate({ text: protectedText, sourceLang: 'th', targetLang: 'en' });
    } catch (err) {
      console.error(`TranslationService: provider "${this.provider.name}" threw`, err);
      result = { ok: false, reason: 'Translation provider error' };
    }

    if (!result.ok) return result;
    return { ok: true, text: restore(result.text) };
  }
}
