import { AttachmentRepository } from './AttachmentRepository';
import { StorageProvider } from './StorageProvider';
import { StorageProviderFactory } from './StorageProviderFactory';
import { MAX_ARCHIVE_ATTEMPTS } from './AttachmentService';
import { Attachment } from './types';
import { getOrphanRetentionHours } from './orphanConfig';
import { OrphanCleanupAction, OrphanCleanupReport, OrphanCleanupResult, OrphanFinding } from './orphanTypes';

/** `buildStoragePath()` (`AttachmentService.ts`) always embeds the upload
 *  timestamp as the leading numeric segment of an object's filename
 *  (`.../<timestamp>-<safeName>`) - reused here to compute an orphaned
 *  *object*'s age without needing a new `StorageProvider` method (every
 *  provider already returns bare key strings from `list()`; none expose a
 *  last-modified timestamp, and adding one would be exactly the kind of
 *  interface change this milestone's "do not redesign the storage
 *  platform" rules out). Returns `null` for a key that doesn't match the
 *  convention (nothing this platform ever wrote itself). */
function parseKeyTimestampMs(key: string): number | null {
  const lastSegment = key.split('/').pop() ?? '';
  const match = lastSegment.match(/^(\d+)-/);
  if (!match) return null;
  const ms = Number(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

function ageHoursSince(isoOrMs: string | number): number {
  const then = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  return (Date.now() - then) / (60 * 60 * 1000);
}

/**
 * Storage Hygiene (`docs/engineering/STORAGE_HYGIENE.md`) - detects the
 * five orphan-attachment cases this platform can produce and reports
 * them; **never deletes anything unless explicitly told to run in
 * non-dry-run mode**, and even then never touches a `MANUAL_REVIEW`
 * finding. A maintenance tool alongside `AttachmentService`, not a
 * replacement for it - `AttachmentService`'s own upload/archive/restore
 * behavior is completely unchanged by this class existing.
 */
export class OrphanCleanupService {
  constructor(
    private readonly repo: AttachmentRepository = new AttachmentRepository(),
    private readonly provider: StorageProvider = StorageProviderFactory.createPrimaryProvider()
  ) {}

  /** Case: an object in storage with no `attachments` row referencing it. */
  async detectOrphanObjects(module: string, retentionHours: number): Promise<OrphanFinding[]> {
    const [objectKeys, rows] = await Promise.all([this.provider.list(module), this.repo.listAllForModule(module)]);
    const referencedPaths = new Set(rows.map((r) => r.storagePath).filter((p): p is string => !!p));

    const findings: OrphanFinding[] = [];
    for (const key of objectKeys) {
      if (referencedPaths.has(key)) continue;
      const timestampMs = parseKeyTimestampMs(key);
      // No embedded timestamp -> not something this platform wrote via
      // buildStoragePath() (e.g. a hand-uploaded test object) - still
      // worth surfacing, but age is unknown, so never auto-recommended
      // for deletion; a human decides.
      if (timestampMs === null) {
        findings.push({
          kind: 'ORPHAN_OBJECT',
          attachmentId: null,
          objectKey: key,
          provider: this.provider.name,
          ageHours: Infinity,
          reason: 'Object exists with no matching attachments row, and its key has no parseable upload timestamp',
          recommendedAction: 'MANUAL_REVIEW',
        });
        continue;
      }
      const ageHours = ageHoursSince(timestampMs);
      if (ageHours < retentionHours) continue; // still within the grace window - may just be mid-upload
      findings.push({
        kind: 'ORPHAN_OBJECT',
        attachmentId: null,
        objectKey: key,
        provider: this.provider.name,
        ageHours,
        reason: 'Object exists in storage with no attachments row referencing it',
        recommendedAction: 'DELETE_OBJECT',
      });
    }
    return findings;
  }

  /** Cases: orphan row (object missing), abandoned direct upload, and
   *  failed archive/restore - all row-centric, so detected together off
   *  one `listAllForModule()` scan. */
  async detectOrphanRows(module: string, retentionHours: number): Promise<OrphanFinding[]> {
    const rows = await this.repo.listAllForModule(module);
    const findings: OrphanFinding[] = [];

    for (const row of rows) {
      const finding = await this.classifyRow(row, retentionHours);
      if (finding) findings.push(finding);
    }
    return findings;
  }

  private async classifyRow(row: Attachment, retentionHours: number): Promise<OrphanFinding | null> {
    // Abandoned direct upload: initDirectUpload()'s placeholder
    // (sizeBytes 0, checksum null) that finalizeDirectUpload() never
    // completed.
    if (row.status === 'ACTIVE' && row.sizeBytes === 0 && row.checksum === null) {
      const ageHours = ageHoursSince(row.createdAt);
      if (ageHours < retentionHours) return null;
      return {
        kind: 'ABANDONED_UPLOAD',
        attachmentId: row.id,
        objectKey: row.storagePath,
        provider: row.storageProvider,
        ageHours,
        reason: 'Direct-upload placeholder row was never finalized (browser PUT likely interrupted or abandoned)',
        recommendedAction: 'DELETE_ROW',
      };
    }

    // Orphan row: an ACTIVE row whose object no longer exists in storage.
    if (row.status === 'ACTIVE' && row.storagePath) {
      const ageHours = ageHoursSince(row.updatedAt);
      if (ageHours >= retentionHours) {
        const exists = await this.provider.exists(row.storagePath);
        if (!exists) {
          return {
            kind: 'ORPHAN_ROW',
            attachmentId: row.id,
            objectKey: row.storagePath,
            provider: row.storageProvider,
            ageHours,
            reason: 'Attachment row references an object that no longer exists in storage',
            recommendedAction: 'DELETE_ROW',
          };
        }
      }
    }

    // Failed archive: stuck past its retry budget, or simply stuck too
    // long (a crash between markArchiving() and completion leaves a row
    // ARCHIVING forever, since processArchiveQueue() only re-queries
    // ARCHIVE_PENDING).
    if (row.status === 'ARCHIVE_PENDING' || row.status === 'ARCHIVING') {
      const referenceTime = row.lastArchiveAttemptAt ?? row.updatedAt;
      const ageHours = ageHoursSince(referenceTime);
      const exhausted = row.archiveAttempts >= MAX_ARCHIVE_ATTEMPTS;
      if (exhausted || ageHours >= retentionHours) {
        return {
          kind: 'FAILED_ARCHIVE',
          attachmentId: row.id,
          objectKey: row.storagePath,
          provider: row.storageProvider,
          ageHours,
          reason: exhausted
            ? `Archive retry budget exhausted (${row.archiveAttempts}/${MAX_ARCHIVE_ATTEMPTS} attempts)`
            : `Stuck in ${row.status} for ${ageHours.toFixed(1)}h with no further attempts recorded`,
          recommendedAction: exhausted ? 'MANUAL_REVIEW' : 'RETRY_ARCHIVE',
        };
      }
    }

    // Failed restore (partial signal only - see orphanTypes.ts's doc
    // comment on why this can't be fully detected): an ARCHIVED row
    // missing the Drive reference it should always have.
    if (row.status === 'ARCHIVED' && !row.driveFileId) {
      return {
        kind: 'FAILED_RESTORE',
        attachmentId: row.id,
        objectKey: row.storagePath,
        provider: row.storageProvider,
        ageHours: ageHoursSince(row.updatedAt),
        reason: 'Row is ARCHIVED but has no drive_file_id - likely left inconsistent by an interrupted restore or archive',
        recommendedAction: 'MANUAL_REVIEW',
      };
    }

    return null;
  }

  async generateReport(module: string, retentionHours: number = getOrphanRetentionHours()): Promise<OrphanCleanupReport> {
    const [objectFindings, rowFindings] = await Promise.all([
      this.detectOrphanObjects(module, retentionHours),
      this.detectOrphanRows(module, retentionHours),
    ]);
    const findings = [...objectFindings, ...rowFindings];
    return {
      module,
      scannedAt: new Date().toISOString(),
      retentionHours,
      findings,
      summary: {
        orphanObjectCount: objectFindings.length,
        orphanRowCount: rowFindings.length,
        cleanupCount: 0,
        skippedCount: 0,
        failedCleanupCount: 0,
      },
    };
  }

  /** Executes (or, if `dryRun`, simulates) the recommended action for
   *  every finding in a report. `MANUAL_REVIEW` findings are always
   *  skipped, dry-run or not - "never delete automatically by default"
   *  applies doubly to anything this service itself couldn't classify
   *  with confidence. Safe-cleanup mode is `dryRun: false` - the only way
   *  a deletion actually happens; callers must opt in explicitly every
   *  time, there is no persistent "auto mode." */
  async cleanup(report: OrphanCleanupReport, options: { dryRun: boolean }): Promise<OrphanCleanupResult> {
    const actions: OrphanCleanupAction[] = [];

    for (const finding of report.findings) {
      if (options.dryRun || finding.recommendedAction === 'MANUAL_REVIEW') {
        actions.push({ finding, outcome: 'SKIPPED' });
        continue;
      }

      try {
        switch (finding.recommendedAction) {
          case 'DELETE_OBJECT':
            if (!finding.objectKey) throw new Error('No object key to delete');
            await this.provider.delete(finding.objectKey);
            break;
          case 'DELETE_ROW':
            if (!finding.attachmentId) throw new Error('No attachment id to delete');
            await this.repo.delete(finding.attachmentId);
            break;
          case 'RETRY_ARCHIVE':
            if (!finding.attachmentId) throw new Error('No attachment id to retry');
            await this.repo.markArchivePending(finding.attachmentId);
            break;
          default:
            throw new Error(`Unhandled recommended action: ${finding.recommendedAction}`);
        }
        actions.push({ finding, outcome: 'CLEANED' });
      } catch (err) {
        actions.push({ finding, outcome: 'FAILED', error: err instanceof Error ? err.message : String(err) });
      }
    }

    const summary = {
      ...report.summary,
      cleanupCount: actions.filter((a) => a.outcome === 'CLEANED').length,
      skippedCount: actions.filter((a) => a.outcome === 'SKIPPED').length,
      failedCleanupCount: actions.filter((a) => a.outcome === 'FAILED').length,
    };

    return {
      report: { ...report, summary },
      dryRun: options.dryRun,
      actions,
    };
  }
}
