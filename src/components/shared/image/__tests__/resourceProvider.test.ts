import { describe, expect, it, vi } from 'vitest';
import { InMemoryAttachmentResourceProvider } from '../resourceProvider';
import { createImageItem } from '../types';

const item = (url: string, expiresAt: string | null = null) => createImageItem({
  id: 'image-1',
  attachmentId: 'attachment-1',
  displayUrl: url,
  sourceKind: 'signed',
  mimeType: 'image/jpeg',
  alt: 'Test image',
  expiresAt,
});

describe('InMemoryAttachmentResourceProvider', () => {
  it('loads and caches a resource', async () => {
    const loader = vi.fn().mockResolvedValue(item('https://signed/one'));
    const provider = new InMemoryAttachmentResourceProvider(loader);

    await expect(provider.get('attachment-1')).resolves.toMatchObject({ displayUrl: 'https://signed/one', resourceState: 'loaded' });
    await provider.get('attachment-1');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(provider.getSnapshot('attachment-1').state).toBe('loaded');
  });

  it('refreshes an expired resource and exposes the expired transition', async () => {
    let now = Date.parse('2026-01-01T00:00:00.000Z');
    const loader = vi.fn()
      .mockResolvedValueOnce(item('https://signed/old', '2026-01-01T00:00:10.000Z'))
      .mockResolvedValueOnce(item('https://signed/new', '2026-01-01T01:00:00.000Z'));
    const provider = new InMemoryAttachmentResourceProvider(loader, { now: () => now, expirySafetyMarginMs: 0 });

    await provider.get('attachment-1');
    now += 11_000;
    expect(provider.getSnapshot('attachment-1').state).toBe('expired');
    await expect(provider.get('attachment-1')).resolves.toMatchObject({ displayUrl: 'https://signed/new' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('retries once and records a failed terminal state', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('expired link'));
    const provider = new InMemoryAttachmentResourceProvider(loader, { maxRetries: 1 });

    await expect(provider.get('attachment-1')).rejects.toThrow('expired link');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(provider.getSnapshot('attachment-1')).toMatchObject({ state: 'failed', retryCount: 1, error: { message: 'expired link' } });
  });

  it('deduplicates concurrent loads', async () => {
    let resolve!: (value: ReturnType<typeof item>) => void;
    const loader = vi.fn().mockReturnValue(new Promise((done) => { resolve = done; }));
    const provider = new InMemoryAttachmentResourceProvider(loader);
    const first = provider.get('attachment-1');
    const second = provider.get('attachment-1');

    resolve(item('https://signed/shared'));
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
