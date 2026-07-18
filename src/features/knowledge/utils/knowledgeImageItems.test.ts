import { describe, expect, it } from 'vitest';
import { knowledgeAttachmentsToImageItems } from './knowledgeImageItems';
import type { Attachment } from '@/shared/attachments';

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-knowledge-1',
    module: 'knowledge',
    entityType: 'knowledge_case',
    entityId: 'case-1',
    attachmentType: 'Other',
    filename: 'knowledge-photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    checksum: null,
    storageProvider: 'SUPABASE',
    storagePath: 'knowledge/case-1/knowledge-photo.jpg',
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

describe('knowledgeAttachmentsToImageItems', () => {
  it('preserves attachment ID and legacy URL fallback', () => {
    const [item] = knowledgeAttachmentsToImageItems([
      attachment({ driveUrl: 'https://legacy.example/knowledge-photo.jpg' }),
    ]);

    expect(item).toMatchObject({
      id: 'att-knowledge-1',
      attachmentId: 'att-knowledge-1',
      displayUrl: 'https://legacy.example/knowledge-photo.jpg',
      sourceKind: 'cdn',
      resourceState: 'loaded',
    });
  });

  it('preserves mixed image and document records', () => {
    const items = knowledgeAttachmentsToImageItems([
      attachment({ id: 'att-photo' }),
      attachment({ id: 'att-pdf', filename: 'knowledge.pdf', mimeType: 'application/pdf' }),
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.attachmentId)).toEqual(['att-photo', 'att-pdf']);
    expect(items[1]).toMatchObject({ mimeType: 'application/pdf', displayUrl: null, resourceState: 'idle' });
  });
});
