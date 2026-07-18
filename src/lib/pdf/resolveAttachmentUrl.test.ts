import { describe, it, expect, vi } from 'vitest';
import { resolvePdfAttachmentUrl } from './resolveAttachmentUrl';
import type { AttachmentService } from '@/shared/attachments';

function mockAttachmentService(impl: (id: string) => Promise<{ url: string; expiresAt: string | null } | null>): AttachmentService {
  return { getUrl: vi.fn(impl) } as unknown as AttachmentService;
}

describe('resolvePdfAttachmentUrl', () => {
  it('returns the fallback URL unchanged when no attachmentId exists (legacy pre-Attachment-Platform record)', async () => {
    const service = mockAttachmentService(async () => {
      throw new Error('should never be called');
    });
    const result = await resolvePdfAttachmentUrl(service, null, 'https://legacy.example.com/photo.jpg');
    expect(result).toBe('https://legacy.example.com/photo.jpg');
  });

  it('returns a freshly resolved signed URL when attachmentId resolves successfully (Defect 1 root cause fix)', async () => {
    const service = mockAttachmentService(async () => ({ url: 'https://fresh.example.com/signed?exp=later', expiresAt: '2026-08-01T00:00:00Z' }));
    const result = await resolvePdfAttachmentUrl(service, 'att-1', 'https://stale.example.com/expired-signature');
    expect(result).toBe('https://fresh.example.com/signed?exp=later');
  });

  it('fails open to the stale fallback URL when resolution returns null (e.g. attachment row deleted)', async () => {
    const service = mockAttachmentService(async () => null);
    const result = await resolvePdfAttachmentUrl(service, 'att-missing', 'https://stale.example.com/old.jpg');
    expect(result).toBe('https://stale.example.com/old.jpg');
  });

  it('fails open to the stale fallback URL when the service itself throws, never propagating the error', async () => {
    const service = mockAttachmentService(async () => {
      throw new Error('supabase connection reset');
    });
    const result = await resolvePdfAttachmentUrl(service, 'att-1', 'https://stale.example.com/old.jpg');
    expect(result).toBe('https://stale.example.com/old.jpg');
  });

  it('returns null when there is neither an attachmentId nor a fallback URL', async () => {
    const service = mockAttachmentService(async () => null);
    const result = await resolvePdfAttachmentUrl(service, null, null);
    expect(result).toBeNull();
  });
});
