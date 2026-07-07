import { describe, it, expect, vi } from 'vitest';
import { StorageMetricsService } from '../StorageMetricsService';
import { AttachmentRepository } from '../AttachmentRepository';
import { OrphanCleanupService } from '../OrphanCleanupService';
import { Attachment } from '../types';

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'a1',
    module: 'pm',
    entityType: 'pm_record',
    entityId: 'rec-1',
    attachmentType: 'ReportPhoto',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    checksum: 'abc123',
    storageProvider: 'CLOUDFLARE_R2',
    storagePath: 'pm/pm_record/rec-1/1-photo.jpg',
    driveFileId: null,
    driveUrl: null,
    status: 'ACTIVE',
    archiveAttempts: 0,
    lastArchiveAttemptAt: null,
    archiveError: null,
    archivedAt: null,
    businessCompletedAt: null,
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRepo(rows: Attachment[]): AttachmentRepository {
  return { listAllForModule: vi.fn().mockResolvedValue(rows) } as unknown as AttachmentRepository;
}

function makeOrphanCleanupService(orphanObjectCount: number, orphanRowCount: number): OrphanCleanupService {
  return {
    generateReport: vi.fn().mockResolvedValue({
      module: 'pm',
      scannedAt: new Date().toISOString(),
      retentionHours: 24,
      findings: [],
      summary: { orphanObjectCount, orphanRowCount, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    }),
  } as unknown as OrphanCleanupService;
}

describe('StorageMetricsService.getMetrics', () => {
  it('aggregates total objects, storage bytes, and per-provider breakdown', async () => {
    const rows = [
      makeAttachment({ id: 'r1', storageProvider: 'CLOUDFLARE_R2', sizeBytes: 100 }),
      makeAttachment({ id: 'r2', storageProvider: 'GOOGLE_DRIVE', sizeBytes: 200 }),
      makeAttachment({ id: 'r3', storageProvider: 'CLOUDFLARE_R2', sizeBytes: 50 }),
    ];
    const service = new StorageMetricsService(makeRepo(rows), makeOrphanCleanupService(0, 0));

    const metrics = await service.getMetrics('pm');

    expect(metrics.totalObjects).toBe(3);
    expect(metrics.totalStorageBytes).toBe(350);
    expect(metrics.byProvider.CLOUDFLARE_R2).toEqual({ count: 2, bytes: 150 });
    expect(metrics.byProvider.GOOGLE_DRIVE).toEqual({ count: 1, bytes: 200 });
  });

  it('counts uploadsPerDay as rows created within the last 24 hours', async () => {
    const rows = [
      makeAttachment({ id: 'r1', createdAt: new Date().toISOString() }),
      makeAttachment({ id: 'r2', createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }),
    ];
    const service = new StorageMetricsService(makeRepo(rows), makeOrphanCleanupService(0, 0));

    const metrics = await service.getMetrics('pm');

    expect(metrics.uploadsPerDay).toBe(1);
  });

  it('counts archiveCount as rows with status ARCHIVED', async () => {
    const rows = [makeAttachment({ id: 'r1', status: 'ARCHIVED' }), makeAttachment({ id: 'r2', status: 'ACTIVE' })];
    const service = new StorageMetricsService(makeRepo(rows), makeOrphanCleanupService(0, 0));

    const metrics = await service.getMetrics('pm');

    expect(metrics.archiveCount).toBe(1);
  });

  it('sums orphanCount from OrphanCleanupService.generateReport', async () => {
    const service = new StorageMetricsService(makeRepo([]), makeOrphanCleanupService(2, 3));

    const metrics = await service.getMetrics('pm');

    expect(metrics.orphanCount).toBe(5);
  });

  it('never fabricates downloadsPerDay/deletesPerDay - always null (not tracked by this schema)', async () => {
    const service = new StorageMetricsService(makeRepo([]), makeOrphanCleanupService(0, 0));

    const metrics = await service.getMetrics('pm');

    expect(metrics.downloadsPerDay).toBeNull();
    expect(metrics.deletesPerDay).toBeNull();
  });
});
