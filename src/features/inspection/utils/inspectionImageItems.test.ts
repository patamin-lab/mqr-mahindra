import { describe, expect, it } from 'vitest';
import { inspectionAttachmentsToImageItems } from './inspectionImageItems';
import type { Attachment } from '@/shared/attachments';

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-1',
    module: 'pdi',
    entityType: 'Inspection',
    entityId: 'inspection-1',
    attachmentType: 'InspectionEvidencePhoto',
    filename: 'evidence.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    checksum: null,
    storageProvider: 'SUPABASE',
    storagePath: 'pdi/inspection-1/evidence.jpg',
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

describe('inspectionAttachmentsToImageItems', () => {
  it('keeps attachment ID and legacy URL as presentation metadata', () => {
    const [item] = inspectionAttachmentsToImageItems([
      { ...attachment(), url: 'https://legacy.example/evidence.jpg' },
    ]);

    expect(item).toMatchObject({
      id: 'att-1',
      attachmentId: 'att-1',
      displayUrl: 'https://legacy.example/evidence.jpg',
      sourceKind: 'cdn',
      mimeType: 'image/jpeg',
      filename: 'evidence.jpg',
      resourceState: 'loaded',
    });
  });

  it('uses archived drive URL fallback and preserves mixed attachment records', () => {
    const items = inspectionAttachmentsToImageItems([
      attachment({ id: 'att-image', driveUrl: 'https://drive.example/image.jpg' }),
      attachment({ id: 'att-pdf', filename: 'report.pdf', mimeType: 'application/pdf', driveUrl: null }),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ attachmentId: 'att-image', displayUrl: 'https://drive.example/image.jpg' });
    expect(items[1]).toMatchObject({ attachmentId: 'att-pdf', displayUrl: null, mimeType: 'application/pdf', resourceState: 'idle' });
  });
});
