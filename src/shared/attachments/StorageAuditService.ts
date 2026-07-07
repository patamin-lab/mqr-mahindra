import { StorageProviderFactory } from './StorageProviderFactory';
import { StorageHealthService } from './StorageHealthService';
import { StorageMetricsService } from './StorageMetricsService';
import { StorageAuditReport, StorageJobResult } from './storageOperationsTypes';

/**
 * Storage Operations (`docs/engineering/STORAGE_OPERATIONS.md`) - builds
 * one `StorageAuditReport` across a set of modules by composing
 * `StorageHealthService` and `StorageMetricsService`; adds no new
 * persistence of its own.
 *
 * `storageGrowth` and `failedJobs` need a point of comparison this
 * platform doesn't yet store anywhere (no audit-report history table,
 * no job-run history table - both would be schema additions, out of
 * scope for "do not redesign the storage architecture"). Callers that
 * already keep yesterday's report/job results (e.g. a future cron
 * wrapper logging its own output) can pass them in via `previousReport`/
 * `recentJobResults`; without them, this service reports what it
 * honestly can - current totals, zero known failures - rather than
 * fabricating a trend.
 */
export class StorageAuditService {
  constructor(
    private readonly healthService: StorageHealthService = new StorageHealthService(),
    private readonly metricsService: StorageMetricsService = new StorageMetricsService()
  ) {}

  async generateDailyAuditReport(
    modules: string[],
    options: { previousReport?: StorageAuditReport; recentJobResults?: StorageJobResult[] } = {}
  ): Promise<StorageAuditReport> {
    const primary = StorageProviderFactory.createPrimaryProvider();
    const archiveProvider = StorageProviderFactory.createArchiveProvider();

    const metricsPerModule = await Promise.all(modules.map((module) => this.metricsService.getMetrics(module)));

    // Health is checked once per provider against the first module in the
    // list (a probe object is provider-level, not module-specific data) -
    // `storageUsageBytes` on each report is still scoped to that one
    // module, matching every other module-scoped figure in this platform.
    const healthModule = modules[0] ?? 'unscoped';
    const providerHealth = await Promise.all([
      this.healthService.checkHealth(primary, healthModule),
      this.healthService.checkHealth(archiveProvider, healthModule),
    ]);

    const orphanCount = metricsPerModule.reduce((sum, m) => sum + m.orphanCount, 0);
    const archiveCount = metricsPerModule.reduce((sum, m) => sum + m.archiveCount, 0);
    const currentBytes = metricsPerModule.reduce((sum, m) => sum + m.totalStorageBytes, 0);

    const previousBytes = options.previousReport?.storageGrowth.currentBytes ?? null;
    const deltaBytes = previousBytes === null ? null : currentBytes - previousBytes;
    const deltaPercent = previousBytes === null || previousBytes === 0 ? null : ((currentBytes - previousBytes) / previousBytes) * 100;

    return {
      generatedAt: new Date().toISOString(),
      modules,
      providerHealth,
      orphanSummary: { orphanCount },
      archiveSummary: { archiveCount },
      storageGrowth: { currentBytes, previousBytes, deltaBytes, deltaPercent },
      failedJobs: (options.recentJobResults ?? []).filter((j) => !j.success),
    };
  }
}
