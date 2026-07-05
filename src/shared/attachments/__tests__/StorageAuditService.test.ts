import { describe, it, expect, vi } from 'vitest';
import { StorageAuditService } from '../StorageAuditService';
import { StorageHealthService } from '../StorageHealthService';
import { StorageMetricsService } from '../StorageMetricsService';
import { StorageProviderFactory } from '../StorageProviderFactory';

vi.mock('../StorageProviderFactory', () => ({
  StorageProviderFactory: {
    createPrimaryProvider: vi.fn().mockReturnValue({ name: 'CLOUDFLARE_R2' }),
    createArchiveProvider: vi.fn().mockReturnValue({ name: 'GOOGLE_DRIVE' }),
  },
}));

function makeHealthService(): StorageHealthService {
  return {
    checkHealth: vi.fn().mockImplementation((provider) =>
      Promise.resolve({
        provider: provider.name,
        status: 'UP',
        uploadLatencyMs: 10,
        downloadLatencyMs: 10,
        archiveErrorRate: null,
        storageUsageBytes: 0,
        checkedAt: new Date().toISOString(),
        error: null,
      })
    ),
  } as unknown as StorageHealthService;
}

function makeMetricsService(perModule: Record<string, { totalStorageBytes: number; orphanCount: number; archiveCount: number }>): StorageMetricsService {
  return {
    getMetrics: vi.fn().mockImplementation((module: string) =>
      Promise.resolve({
        module,
        totalObjects: 1,
        totalStorageBytes: perModule[module].totalStorageBytes,
        byProvider: {},
        uploadsPerDay: 0,
        archiveCount: perModule[module].archiveCount,
        orphanCount: perModule[module].orphanCount,
        downloadsPerDay: null,
        deletesPerDay: null,
        generatedAt: new Date().toISOString(),
      })
    ),
  } as unknown as StorageMetricsService;
}

describe('StorageAuditService.generateDailyAuditReport', () => {
  it('checks health for both primary and archive providers', async () => {
    const healthService = makeHealthService();
    const metricsService = makeMetricsService({ pm: { totalStorageBytes: 100, orphanCount: 0, archiveCount: 0 } });
    const service = new StorageAuditService(healthService, metricsService);

    const report = await service.generateDailyAuditReport(['pm']);

    expect(report.providerHealth).toHaveLength(2);
    expect(report.providerHealth.map((h) => h.provider)).toEqual(['CLOUDFLARE_R2', 'GOOGLE_DRIVE']);
    expect(StorageProviderFactory.createPrimaryProvider).toHaveBeenCalled();
  });

  it('aggregates orphan and archive summaries and current storage bytes across modules', async () => {
    const metricsService = makeMetricsService({
      pm: { totalStorageBytes: 100, orphanCount: 2, archiveCount: 1 },
      mqr: { totalStorageBytes: 300, orphanCount: 1, archiveCount: 4 },
    });
    const service = new StorageAuditService(makeHealthService(), metricsService);

    const report = await service.generateDailyAuditReport(['pm', 'mqr']);

    expect(report.orphanSummary.orphanCount).toBe(3);
    expect(report.archiveSummary.archiveCount).toBe(5);
    expect(report.storageGrowth.currentBytes).toBe(400);
  });

  it('reports null growth when no previous report is supplied', async () => {
    const metricsService = makeMetricsService({ pm: { totalStorageBytes: 100, orphanCount: 0, archiveCount: 0 } });
    const service = new StorageAuditService(makeHealthService(), metricsService);

    const report = await service.generateDailyAuditReport(['pm']);

    expect(report.storageGrowth.previousBytes).toBeNull();
    expect(report.storageGrowth.deltaBytes).toBeNull();
    expect(report.storageGrowth.deltaPercent).toBeNull();
  });

  it('computes growth deltas when a previous report is supplied', async () => {
    const metricsService = makeMetricsService({ pm: { totalStorageBytes: 150, orphanCount: 0, archiveCount: 0 } });
    const service = new StorageAuditService(makeHealthService(), metricsService);
    const previousReport = await service.generateDailyAuditReport(['pm']);

    const metricsServiceGrown = makeMetricsService({ pm: { totalStorageBytes: 300, orphanCount: 0, archiveCount: 0 } });
    const serviceGrown = new StorageAuditService(makeHealthService(), metricsServiceGrown);
    const nextReport = await serviceGrown.generateDailyAuditReport(['pm'], { previousReport });

    expect(nextReport.storageGrowth.previousBytes).toBe(150);
    expect(nextReport.storageGrowth.deltaBytes).toBe(150);
    expect(nextReport.storageGrowth.deltaPercent).toBe(100);
  });

  it('filters recentJobResults down to only failed jobs', async () => {
    const metricsService = makeMetricsService({ pm: { totalStorageBytes: 100, orphanCount: 0, archiveCount: 0 } });
    const service = new StorageAuditService(makeHealthService(), metricsService);
    const recentJobResults = [
      { jobType: 'ARCHIVE' as const, module: 'pm', startedAt: 'x', finishedAt: 'y', success: true, summary: {}, error: null },
      { jobType: 'ORPHAN_CLEANUP' as const, module: 'pm', startedAt: 'x', finishedAt: 'y', success: false, summary: null, error: 'boom' },
    ];

    const report = await service.generateDailyAuditReport(['pm'], { recentJobResults });

    expect(report.failedJobs).toHaveLength(1);
    expect(report.failedJobs[0].error).toBe('boom');
  });
});
