import { AttachmentRepository } from './AttachmentRepository';
import { StorageProvider } from './StorageProvider';
import { ProviderHealthReport, ProviderHealthStatus } from './storageOperationsTypes';

/** Past this latency a successful probe is reported `DEGRADED` rather than
 *  `UP` - not a hard SLA, just a signal worth surfacing in the daily audit
 *  rather than silently calling a slow provider healthy. */
const DEGRADED_LATENCY_MS = 3000;

const PROBE_PREFIX = '_health-check';
const PROBE_BODY = Buffer.from('storage-health-probe');

function probePath(): string {
  return `${PROBE_PREFIX}/${Date.now()}.probe`;
}

/**
 * Storage Operations (`docs/engineering/STORAGE_OPERATIONS.md`) - live,
 * on-demand health probes against one `StorageProvider`. Never runs on a
 * timer itself (no automatic scheduling here - `StorageScheduler` is the
 * only thing that can invoke this, and only when something else calls
 * it); every report reflects the instant it was requested.
 */
export class StorageHealthService {
  constructor(private readonly repo: AttachmentRepository = new AttachmentRepository()) {}

  /** Round-trips a small throwaway object through `provider` to measure
   *  real upload/download latency, then removes it. `module` scopes the
   *  `storageUsageBytes` figure (an aggregate over existing rows, not
   *  something the probe itself produces). */
  async checkHealth(provider: StorageProvider, module: string): Promise<ProviderHealthReport> {
    const checkedAt = new Date().toISOString();
    let uploadLatencyMs: number | null = null;
    let downloadLatencyMs: number | null = null;
    let status: ProviderHealthStatus = 'UP';
    let error: string | null = null;
    let locator: string | null = null;

    try {
      const uploadStart = Date.now();
      const stored = await provider.upload({ path: probePath(), buffer: PROBE_BODY, mimeType: 'text/plain' });
      uploadLatencyMs = Date.now() - uploadStart;
      locator = stored.locator;

      const downloadStart = Date.now();
      await provider.download(stored.locator);
      downloadLatencyMs = Date.now() - downloadStart;

      status = Math.max(uploadLatencyMs, downloadLatencyMs) > DEGRADED_LATENCY_MS ? 'DEGRADED' : 'UP';
    } catch (err) {
      status = 'DOWN';
      error = err instanceof Error ? err.message : String(err);
    } finally {
      if (locator) {
        try {
          await provider.delete(locator);
        } catch {
          // Best-effort cleanup of the probe object - a failed delete here
          // doesn't change the health verdict already determined above.
        }
      }
    }

    const [archiveErrorRate, storageUsageBytes] = await Promise.all([
      this.getArchiveErrorRate(),
      this.getStorageUsageBytes(module, provider.name),
    ]);

    return { provider: provider.name, status, uploadLatencyMs, downloadLatencyMs, archiveErrorRate, storageUsageBytes, checkedAt, error };
  }

  private async getArchiveErrorRate(): Promise<number | null> {
    const [pending, archiving] = await Promise.all([this.repo.listByStatus('ARCHIVE_PENDING'), this.repo.listByStatus('ARCHIVING')]);
    const attempted = [...pending, ...archiving];
    if (attempted.length === 0) return null;
    const withError = attempted.filter((a) => a.archiveError !== null).length;
    return withError / attempted.length;
  }

  private async getStorageUsageBytes(module: string, providerName: StorageProvider['name']): Promise<number> {
    const rows = await this.repo.listAllForModule(module);
    return rows.filter((r) => r.storageProvider === providerName).reduce((sum, r) => sum + (r.sizeBytes ?? 0), 0);
  }
}
