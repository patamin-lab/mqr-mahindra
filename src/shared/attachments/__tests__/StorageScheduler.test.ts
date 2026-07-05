import { describe, it, expect, vi } from 'vitest';
import { StorageScheduler } from '../StorageScheduler';
import { AttachmentService } from '../AttachmentService';
import { OrphanCleanupService } from '../OrphanCleanupService';
import { StorageHealthService } from '../StorageHealthService';
import { StorageProvider } from '../StorageProvider';

function makeAttachmentService(overrides: Partial<AttachmentService> = {}): AttachmentService {
  return {
    enqueueArchiveEligible: vi.fn().mockResolvedValue(0),
    processArchiveQueue: vi.fn().mockResolvedValue({ archived: 0, failed: 0 }),
    ...overrides,
  } as unknown as AttachmentService;
}

function makeOrphanCleanupService(overrides: Partial<OrphanCleanupService> = {}): OrphanCleanupService {
  return {
    generateReport: vi.fn().mockResolvedValue({
      module: 'pm',
      scannedAt: new Date().toISOString(),
      retentionHours: 24,
      findings: [],
      summary: { orphanObjectCount: 0, orphanRowCount: 0, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    }),
    cleanup: vi.fn().mockImplementation((report) => Promise.resolve({ report, dryRun: true, actions: [] })),
    ...overrides,
  } as unknown as OrphanCleanupService;
}

function makeHealthService(overrides: Partial<StorageHealthService> = {}): StorageHealthService {
  return {
    checkHealth: vi.fn().mockResolvedValue({
      provider: 'CLOUDFLARE_R2',
      status: 'UP',
      uploadLatencyMs: 10,
      downloadLatencyMs: 10,
      archiveErrorRate: null,
      storageUsageBytes: 0,
      checkedAt: new Date().toISOString(),
      error: null,
    }),
    ...overrides,
  } as unknown as StorageHealthService;
}

const fakeProvider = { name: 'CLOUDFLARE_R2' } as unknown as StorageProvider;

describe('StorageScheduler', () => {
  it('runArchiveJob calls enqueueArchiveEligible then processArchiveQueue and reports success', async () => {
    const attachmentService = makeAttachmentService({ enqueueArchiveEligible: vi.fn().mockResolvedValue(3) } as any);
    const scheduler = new StorageScheduler(attachmentService, makeOrphanCleanupService(), makeHealthService());

    const result = await scheduler.runArchiveJob('pm');

    expect(result.jobType).toBe('ARCHIVE');
    expect(result.success).toBe(true);
    expect(result.summary).toEqual({ enqueued: 3, archived: 0, failed: 0 });
    expect(attachmentService.enqueueArchiveEligible).toHaveBeenCalledWith('pm');
  });

  it('runArchiveJob reports failure without throwing when the underlying service throws', async () => {
    const attachmentService = makeAttachmentService({ enqueueArchiveEligible: vi.fn().mockRejectedValue(new Error('db down')) } as any);
    const scheduler = new StorageScheduler(attachmentService, makeOrphanCleanupService(), makeHealthService());

    const result = await scheduler.runArchiveJob('pm');

    expect(result.success).toBe(false);
    expect(result.error).toBe('db down');
  });

  it('runOrphanCleanupJob defaults to dryRun:true', async () => {
    const orphanCleanupService = makeOrphanCleanupService();
    const scheduler = new StorageScheduler(makeAttachmentService(), orphanCleanupService, makeHealthService());

    await scheduler.runOrphanCleanupJob('pm');

    expect(orphanCleanupService.cleanup).toHaveBeenCalledWith(expect.anything(), { dryRun: true });
  });

  it('runOrphanCleanupJob only actions deletes when the caller explicitly passes dryRun:false', async () => {
    const orphanCleanupService = makeOrphanCleanupService();
    const scheduler = new StorageScheduler(makeAttachmentService(), orphanCleanupService, makeHealthService());

    await scheduler.runOrphanCleanupJob('pm', { dryRun: false });

    expect(orphanCleanupService.cleanup).toHaveBeenCalledWith(expect.anything(), { dryRun: false });
  });

  it('runHealthCheckJob delegates to StorageHealthService.checkHealth', async () => {
    const healthService = makeHealthService();
    const scheduler = new StorageScheduler(makeAttachmentService(), makeOrphanCleanupService(), healthService);

    const result = await scheduler.runHealthCheckJob(fakeProvider, 'pm');

    expect(result.jobType).toBe('HEALTH_CHECK');
    expect(result.success).toBe(true);
    expect(healthService.checkHealth).toHaveBeenCalledWith(fakeProvider, 'pm');
  });
});
