import { describe, it, expect, vi } from 'vitest';
import { TranslationService } from './translationService';
import type { MachineTranslationProvider, TranslationRequest, TranslationResult } from './types';
import { NoopMachineTranslationProvider } from './providers/NoopMachineTranslationProvider';

function fakeProvider(impl: (req: TranslationRequest) => Promise<TranslationResult>): MachineTranslationProvider {
  return { name: 'fake', translate: vi.fn(impl) };
}

describe('TranslationService', () => {
  it('short-circuits to an empty ok result for null/undefined/whitespace-only text, never calling the provider', async () => {
    const provider = fakeProvider(async () => ({ ok: true, text: 'should never be called' }));
    const service = new TranslationService(provider);

    expect(await service.translateToEnglish(null)).toEqual({ ok: true, text: '' });
    expect(await service.translateToEnglish(undefined)).toEqual({ ok: true, text: '' });
    expect(await service.translateToEnglish('   ')).toEqual({ ok: true, text: '' });
    expect(provider.translate).not.toHaveBeenCalled();
  });

  it('never throws when the provider itself throws - Defect 2 requirement: translation failure must never stop PDF generation', async () => {
    const provider = fakeProvider(async () => {
      throw new Error('network down');
    });
    const service = new TranslationService(provider);

    const result = await service.translateToEnglish('ทดสอบ');
    expect(result.ok).toBe(false);
  });

  it('passes through a provider failure reason unchanged (no terminology/unit post-processing applied to a failure)', async () => {
    const provider = fakeProvider(async () => ({ ok: false, reason: 'quota exceeded' }));
    const service = new TranslationService(provider);

    const result = await service.translateToEnglish('เปลี่ยนลูกปืน');
    expect(result).toEqual({ ok: false, reason: 'quota exceeded' });
  });

  it('substitutes known terminology/units into the Thai SOURCE before calling the provider, not after', async () => {
    // A real provider (Google Translate) returns fully English text with
    // no Thai substrings left - post-processing its output could never
    // match anything. The provider must receive the already-substituted
    // text, and its own (here: pass-through) response is the final result.
    const provider = fakeProvider(async (req) => ({ ok: true, text: req.text }));
    const service = new TranslationService(provider);

    const result = await service.translateToEnglish('เปลี่ยนลูกปืนหลังใช้งาน 20 ชั่วโมง');

    expect(provider.translate).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'เปลี่ยนBearingหลังใช้งาน 20 hours' })
    );
    expect(result).toEqual({ ok: true, text: 'เปลี่ยนBearingหลังใช้งาน 20 hours' });
  });

  it('protects a known acronym with a placeholder before the provider call and restores it verbatim afterward', async () => {
    // Simulates a provider that would otherwise mangle a bare acronym -
    // the placeholder must survive the round trip untouched by the
    // (fake, deliberately mischievous) provider.
    const provider = fakeProvider(async (req) => ({ ok: true, text: `${req.text} (translated)` }));
    const service = new TranslationService(provider);

    const result = await service.translateToEnglish('ตรวจสอบ PTO ก่อนใช้งาน');

    const [[calledRequest]] = (provider.translate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calledRequest.text).not.toContain('PTO');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain('PTO');
      expect(result.text).not.toContain('@@P');
    }
  });

  it('defaults to NoopMachineTranslationProvider, which always resolves to the documented "unavailable" outcome', async () => {
    const service = new TranslationService(new NoopMachineTranslationProvider());
    const result = await service.translateToEnglish('ฝาถังน้ำมันยุบตัว');
    expect(result.ok).toBe(false);
  });
});
