import { describe, expect, it } from 'vitest';
import { machineAttachmentsToImageItems } from './machineImageItems';
import type { Attachment } from '@/shared/attachments';

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-machine-1',
    module: 'mqr',
    entityType: 'record',
    entityId: 'QIR-1',
    attachmentType: 'ReportPhoto',
    filename: 'historical-photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    checksum: null,
    storageProvider: 'SUPABASE',
    storagePath: 'mqr/QIR-1/historical-photo.jpg',
    driveFileId: null,
    driveUrl: null,
    status: 'ACTIVE',
    archiveAttempts: 0,
    lastArchiveAttemptAt: null,
    archiveError: null,
    archivedAt: null,
    businessCompletedAt: null,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('machineAttachmentsToImageItems', () => {
  it('preserves historical attachment identity and legacy URL fallback', () => {
    const [item] = machineAttachmentsToImageItems([
      attachment({ driveUrl: 'https://legacy.example/historical-photo.jpg' }),
    ]);

    expect(item).toMatchObject({
      id: 'att-machine-1',
      attachmentId: 'att-machine-1',
      displayUrl: 'https://legacy.example/historical-photo.jpg',
      sourceKind: 'cdn',
      resourceState: 'loaded',
      mimeType: 'image/jpeg',
    });
  });

  it('keeps mixed image and document records addressable by attachment ID', () => {
    const items = machineAttachmentsToImageItems([
      attachment({ id: 'att-photo' }),
      attachment({ id: 'att-document', filename: 'invoice.pdf', mimeType: 'application/pdf' }),
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.attachmentId)).toEqual(['att-photo', 'att-document']);
    expect(items[1]).toMatchObject({ mimeType: 'application/pdf', displayUrl: null, resourceState: 'idle' });
  });
});
