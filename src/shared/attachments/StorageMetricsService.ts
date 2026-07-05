import { AttachmentRepository } from './AttachmentRepository';
import { OrphanCleanupService } from './OrphanCleanupService';
import { StorageProviderName } from './types';
import { StorageMetricsSnapshot } from './storageOperationsTypes';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Storage Operations (`docs/engineering/STORAGE_OPERATIONS.md`) - read-only
 * aggregation over the existing `attachments` rows for one module. Reuses
 * `AttachmentRepository.listAllForModule()` (already built for
 * `OrphanCleanupService`) rather than adding new SQL aggregation queries -
 * this module's dataset size doesn't warrant a `COUNT`/`SUM` round trip
 * over a full row fetch, and adding one would be exactly the kind of
 * schema/query surface expansion "do not redesign the storage
 * architecture" rules out.
 */
export class StorageMetricsService {
  constructor(
    private readonly repo: AttachmentRepository = new AttachmentRepository(),
    private readonly orphanCleanupService: OrphanCleanupService = new OrphanCleanupService()
  ) {}

  async getMetrics(module: string): Promise<StorageMetricsSnapshot> {
    const rows = await this.repo.listAllForModule(module);
    const now = Date.now();

    const byProvider: Partial<Record<StorageProviderName, { count: number; bytes: number }>> = {};
    let totalStorageBytes = 0;
    let uploadsPerDay = 0;
    let archiveCount = 0;

    for (const row of rows) {
      const bytes = row.sizeBytes ?? 0;
      totalStorageBytes += bytes;

      const bucket = byProvider[row.storageProvider] ?? { count: 0, bytes: 0 };
      bucket.count += 1;
      bucket.bytes += bytes;
      byProvider[row.storageProvider] = bucket;

      if (now - new Date(row.createdAt).getTime() < ONE_DAY_MS) uploadsPerDay += 1;
      if (row.status === 'ARCHIVED') archiveCount += 1;
    }

    const orphanReport = await this.orphanCleanupService.generateReport(module);

    return {
      module,
      totalObjects: rows.length,
      totalStorageBytes,
      byProvider,
      uploadsPerDay,
      archiveCount,
      orphanCount: orphanReport.summary.orphanObjectCount + orphanReport.summary.orphanRowCount,
      downloadsPerDay: null,
      deletesPerDay: null,
      generatedAt: new Date().toISOString(),
    };
  }
}
