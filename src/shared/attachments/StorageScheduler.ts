import { AttachmentService } from './AttachmentService';
import { OrphanCleanupService } from './OrphanCleanupService';
import { StorageHealthService } from './StorageHealthService';
import { StorageProvider } from './StorageProvider';
import { StorageJobResult } from './storageOperationsTypes';

function nowIso(): string {
  return new Date().toISOString();
}

async function runJob(jobType: StorageJobResult['jobType'], module: string | null, task: () => Promise<unknown>): Promise<StorageJobResult> {
  const startedAt = nowIso();
  try {
    const summary = await task();
    return { jobType, module, startedAt, finishedAt: nowIso(), success: true, summary, error: null };
  } catch (err) {
    return { jobType, module, startedAt, finishedAt: nowIso(), success: false, summary: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Storage Operations (`docs/engineering/STORAGE_OPERATIONS.md`) - the
 * callable surface a future cron/scheduler would trigger for the three
 * recurring storage jobs. Composes existing services (`AttachmentService`'s
 * own archive flow, `OrphanCleanupService`, `StorageHealthService`) rather
 * than re-implementing any of their logic - this class only decides "which
 * job ran, when, and did it succeed," never *how* a job does its work.
 *
 * Deliberately **not wired to any timer, `vercel.json` cron entry, or
 * process scheduler** - "do not enable automatic scheduling." Every method
 * here only runs when something else (a manual API call today, a real
 * cron trigger later) calls it.
 */
export class StorageScheduler {
  constructor(
    private readonly attachmentService: AttachmentService = new AttachmentService(),
    private readonly orphanCleanupService: OrphanCleanupService = new OrphanCleanupService(),
    private readonly healthService: StorageHealthService = new StorageHealthService()
  ) {}

  /** Runs the existing two-step archive flow
   *  (`enqueueArchiveEligible` -> `processArchiveQueue`) for one module.
   *  Note `processArchiveQueue()` itself processes every
   *  `ARCHIVE_PENDING` row globally (existing, unchanged behavior, not
   *  module-scoped) - `module` here only scopes which rows get enqueued
   *  by this call. */
  async runArchiveJob(module: string): Promise<StorageJobResult> {
    return runJob('ARCHIVE', module, async () => {
      const enqueued = await this.attachmentService.enqueueArchiveEligible(module);
      const { archived, failed } = await this.attachmentService.processArchiveQueue();
      return { enqueued, archived, failed };
    });
  }

  /** Runs `OrphanCleanupService.generateReport()` and, only if the caller
   *  explicitly passes `dryRun: false`, `.cleanup()`. Defaults to
   *  `dryRun: true` - "do not enable automatic cleanup" applies here
   *  exactly as it does to the API route this wraps. */
  async runOrphanCleanupJob(module: string, options: { dryRun: boolean; retentionHours?: number } = { dryRun: true }): Promise<StorageJobResult> {
    return runJob('ORPHAN_CLEANUP', module, async () => {
      const report = await this.orphanCleanupService.generateReport(module, options.retentionHours);
      const result = await this.orphanCleanupService.cleanup(report, { dryRun: options.dryRun });
      return result.report.summary;
    });
  }

  /** Runs a live probe against `provider` via `StorageHealthService`. */
  async runHealthCheckJob(provider: StorageProvider, module: string): Promise<StorageJobResult> {
    return runJob('HEALTH_CHECK', module, () => this.healthService.checkHealth(provider, module));
  }
}
