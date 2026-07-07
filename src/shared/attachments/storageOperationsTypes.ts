import { StorageProviderName } from './types';

/** `DEGRADED` = the probe succeeded but past the latency threshold;
 *  `DOWN` = the probe itself threw. There is no historical uptime log
 *  behind this - every check is a live, on-demand probe against the real
 *  provider, never a cached/previous result. */
export type ProviderHealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

export interface ProviderHealthReport {
  provider: StorageProviderName;
  status: ProviderHealthStatus;
  uploadLatencyMs: number | null;
  downloadLatencyMs: number | null;
  /** Archive-attempt failure rate (`archive_error` populated rows /
   *  attempted rows currently ARCHIVE_PENDING or ARCHIVING) - the one
   *  error signal this schema already persists. Not a general
   *  upload/download/delete error rate: this platform has no per-request
   *  event log, so that broader rate isn't derivable without a schema
   *  change (`docs/engineering/STORAGE_OPERATIONS.md` flags this as a
   *  known gap, not silently glossed over). Null when there is nothing
   *  currently in the archive queue to measure against. */
  archiveErrorRate: number | null;
  storageUsageBytes: number;
  checkedAt: string;
  error: string | null;
}

export interface StorageMetricsSnapshot {
  module: string;
  totalObjects: number;
  totalStorageBytes: number;
  byProvider: Partial<Record<StorageProviderName, { count: number; bytes: number }>>;
  uploadsPerDay: number;
  archiveCount: number;
  orphanCount: number;
  /** Neither is tracked by the current schema - deletes remove a row
   *  entirely (no tombstone/event log) and downloads (`getSignedUrl`
   *  calls) are never recorded anywhere. Returning `null` rather than a
   *  fabricated number; see STORAGE_OPERATIONS.md's Observability
   *  section for what adding real tracking would require. */
  downloadsPerDay: null;
  deletesPerDay: null;
  generatedAt: string;
}

export type StorageJobType = 'ARCHIVE' | 'ORPHAN_CLEANUP' | 'HEALTH_CHECK';

export interface StorageJobResult {
  jobType: StorageJobType;
  module: string | null;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  summary: unknown;
  error: string | null;
}

export interface StorageAuditReport {
  generatedAt: string;
  modules: string[];
  providerHealth: ProviderHealthReport[];
  orphanSummary: {
    orphanCount: number;
  };
  archiveSummary: {
    archiveCount: number;
  };
  storageGrowth: {
    currentBytes: number;
    previousBytes: number | null;
    deltaBytes: number | null;
    deltaPercent: number | null;
  };
  failedJobs: StorageJobResult[];
}
