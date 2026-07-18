import { MachineTranslationProvider, TranslationResult } from './types';
import { NoopMachineTranslationProvider } from './providers/NoopMachineTranslationProvider';
import { applyTerminologyNormalization } from './terminologyDictionary';
import { normalizeUnits, normalizeWhitespaceAndLists } from './textNormalization';

/**
 * The one thing the PDF layer (or any future caller) depends on -
 * never a specific vendor, never `MachineTranslationProvider` directly.
 * Composes: normalize -> provider.translate() -> terminology
 * normalization -> unit normalization. Translation failure NEVER throws
 * - every path returns a `TranslationResult`, so a PDF's generation can
 * never be blocked by a translation problem (Defect 2's own explicit
 * requirement).
 */
export class TranslationService {
  constructor(private readonly provider: MachineTranslationProvider = new NoopMachineTranslationProvider()) {}

  async translateToEnglish(thaiText: string | null | undefined): Promise<TranslationResult> {
    const trimmed = (thaiText ?? '').trim();
    if (!trimmed) return { ok: true, text: '' };

    const cleaned = normalizeWhitespaceAndLists(trimmed);

    let result: TranslationResult;
    try {
      result = await this.provider.translate({ text: cleaned, sourceLang: 'th', targetLang: 'en' });
    } catch (err) {
      console.error(`TranslationService: provider "${this.provider.name}" threw`, err);
      result = { ok: false, reason: 'Translation provider error' };
    }

    if (!result.ok) return result;

    const withTerminology = applyTerminologyNormalization(result.text);
    const withUnits = normalizeUnits(withTerminology);
    return { ok: true, text: withUnits };
  }
}
