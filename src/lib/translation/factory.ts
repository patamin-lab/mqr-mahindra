import { MachineTranslationProvider } from './types';
import { NoopMachineTranslationProvider } from './providers/NoopMachineTranslationProvider';
import { GoogleTranslateProvider } from './providers/GoogleTranslateProvider';

/**
 * The one place environment configuration is read to decide which
 * `MachineTranslationProvider` is active - every PDF renderer calls this
 * instead of constructing a provider itself, so switching providers later
 * (per-environment, or to a different vendor entirely) is a one-line
 * change here, never a change to the renderers.
 *
 * `GOOGLE_TRANSLATE_API_KEY` not set -> falls back to the no-op provider
 * and logs a warning, the exact same "degrade, never throw" contract this
 * app already uses for Resend (`lib/email.ts`: unset `RESEND_API_KEY`
 * skips sending rather than failing the request it's attached to) - PDF
 * generation must never fail because translation isn't configured.
 */
export function createMachineTranslationProvider(): MachineTranslationProvider {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_TRANSLATE_API_KEY not set - PDF free-text fields will show "Translation unavailable"');
    return new NoopMachineTranslationProvider();
  }
  return new GoogleTranslateProvider(apiKey);
}
