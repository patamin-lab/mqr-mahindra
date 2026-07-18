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

  it('applies terminology and unit normalization on top of a successful provider translation', async () => {
    const provider = fakeProvider(async () => ({ ok: true, text: 'Replace the ลูกปืน after 20 ชั่วโมง of use' }));
    const service = new TranslationService(provider);

    const result = await service.translateToEnglish('เปลี่ยนลูกปืนหลังใช้งาน 20 ชั่วโมง');
    expect(result).toEqual({ ok: true, text: 'Replace the Bearing after 20 hours of use' });
  });

  it('defaults to NoopMachineTranslationProvider, which always resolves to the documented "unavailable" outcome', async () => {
    const service = new TranslationService(new NoopMachineTranslationProvider());
    const result = await service.translateToEnglish('ฝาถังน้ำมันยุบตัว');
    expect(result.ok).toBe(false);
  });
});
