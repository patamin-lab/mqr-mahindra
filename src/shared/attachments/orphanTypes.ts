import { StorageProviderName } from './types';

/**
 * Orphan Attachment — the six cases this platform can leave behind
 * (see `docs/engineering/STORAGE_HYGIENE.md` for the full lifecycle
 * write-up):
 *
 * - `ORPHAN_OBJECT` — an object exists in storage with no `attachments`
 *   row referencing it (e.g. `upload()` succeeded but the DB insert that
 *   should follow it never did).
 * - `ORPHAN_ROW` — an `attachments` row exists whose `storage_path`
 *   doesn't actually exist in storage (e.g. the DB insert succeeded but
 *   something deleted the object out-of-band, or a `delete()` call
 *   removed the object but crashed before removing the row).
 * - `ABANDONED_UPLOAD` — a direct-upload placeholder row
 *   (`initDirectUpload()`'s `sizeBytes: 0`/`checksum: null`) that was
 *   never finalized (the browser's PUT never completed, or the tab was
 *   closed) and has aged past the retention window.
 * - `FAILED_ARCHIVE` — a row stuck in `ARCHIVE_PENDING`/`ARCHIVING` past
 *   its retry budget (`MAX_ARCHIVE_ATTEMPTS`) or simply too long (a crash
 *   between `markArchiving()` and the archive actually completing leaves
 *   a row `ARCHIVING` forever, since `processArchiveQueue()` only ever
 *   re-queries `ARCHIVE_PENDING`, never `ARCHIVING`).
 * - `FAILED_RESTORE` — defined for completeness; **not yet detectable as
 *   its own case**. `AttachmentService.restore()` has no intermediate
 *   "RESTORING" status the way archiving has `ARCHIVING` - if it fails
 *   after uploading a fresh copy to primary storage but before
 *   `repo.restoreToActive()` persists that, the result is an untracked
 *   duplicate object with no DB reference, which surfaces as an
 *   `ORPHAN_OBJECT` instead. See `docs/engineering/STORAGE_HYGIENE.md`'s
 *   Recovery Strategy section.
 */
export type OrphanKind = 'ORPHAN_OBJECT' | 'ORPHAN_ROW' | 'ABANDONED_UPLOAD' | 'FAILED_ARCHIVE' | 'FAILED_RESTORE';

export type RecommendedAction = 'DELETE_OBJECT' | 'DELETE_ROW' | 'RETRY_ARCHIVE' | 'MANUAL_REVIEW';

export interface OrphanFinding {
  kind: OrphanKind;
  attachmentId: string | null;
  objectKey: string | null;
  provider: StorageProviderName | null;
  ageHours: number;
  reason: string;
  recommendedAction: RecommendedAction;
}

export interface OrphanCleanupSummary {
  orphanObjectCount: number;
  orphanRowCount: number;
  cleanupCount: number;
  skippedCount: number;
  failedCleanupCount: number;
}

export interface OrphanCleanupReport {
  module: string;
  scannedAt: string;
  retentionHours: number;
  findings: OrphanFinding[];
  summary: OrphanCleanupSummary;
}

export type CleanupOutcome = 'CLEANED' | 'SKIPPED' | 'FAILED';

export interface OrphanCleanupAction {
  finding: OrphanFinding;
  outcome: CleanupOutcome;
  error?: string;
}

export interface OrphanCleanupResult {
  report: OrphanCleanupReport;
  dryRun: boolean;
  actions: OrphanCleanupAction[];
}
