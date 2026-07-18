import { describe, it, expect, afterEach, vi } from 'vitest';
import { createMachineTranslationProvider } from './factory';
import { NoopMachineTranslationProvider } from './providers/NoopMachineTranslationProvider';
import { GoogleTranslateProvider } from './providers/GoogleTranslateProvider';

describe('createMachineTranslationProvider', () => {
  const originalKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_TRANSLATE_API_KEY;
    else process.env.GOOGLE_TRANSLATE_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('falls back to the no-op provider (and warns) when GOOGLE_TRANSLATE_API_KEY is not set - PDF generation must never depend on it', () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const provider = createMachineTranslationProvider();

    expect(provider).toBeInstanceOf(NoopMachineTranslationProvider);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns a real GoogleTranslateProvider when GOOGLE_TRANSLATE_API_KEY is set', () => {
    process.env.GOOGLE_TRANSLATE_API_KEY = 'test-key-value';

    const provider = createMachineTranslationProvider();

    expect(provider).toBeInstanceOf(GoogleTranslateProvider);
  });
});
