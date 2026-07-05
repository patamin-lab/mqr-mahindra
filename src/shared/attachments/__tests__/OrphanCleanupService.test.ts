import { describe, it, expect, vi } from 'vitest';
import { OrphanCleanupService } from '../OrphanCleanupService';
import { AttachmentRepository } from '../AttachmentRepository';
import { StorageProvider } from '../StorageProvider';
import { Attachment } from '../types';

// Real "now" at test-run time (not a fixed calendar date) - the service
// under test always compares against the real `Date.now()`, so fixtures
// must be relative to that, not to an arbitrary hardcoded timestamp that
// could end up in the future relative to whenever this suite actually runs.
const NOW = new Date();
const HOUR = 60 * 60 * 1000;

function isoHoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function tsMsHoursAgo(hours: number): number {
  return NOW.getTime() - hours * HOUR;
}

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
    createdAt: isoHoursAgo(48),
    updatedAt: isoHoursAgo(48),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AttachmentRepository> = {}): AttachmentRepository {
  return {
    listAllForModule: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    markArchivePending: vi.fn(),
    ...overrides,
  } as unknown as AttachmentRepository;
}

function makeProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    name: 'CLOUDFLARE_R2',
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('OrphanCleanupService.detectOrphanObjects', () => {
  it('flags an object with no matching attachments row, past the retention window', async () => {
    const key = `pm/pm_record/rec-1/${tsMsHoursAgo(48)}-orphaned.jpg`;
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([]) } as any);
    const provider = makeProvider({ list: vi.fn().mockResolvedValue([key]) });
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanObjects('pm', 24);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'ORPHAN_OBJECT', objectKey: key, recommendedAction: 'DELETE_OBJECT' });
  });

  it('does not flag an object that still has a matching row', async () => {
    const key = `pm/pm_record/rec-1/${tsMsHoursAgo(48)}-linked.jpg`;
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([makeAttachment({ storagePath: key })]) } as any);
    const provider = makeProvider({ list: vi.fn().mockResolvedValue([key]) });
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanObjects('pm', 24);

    expect(findings).toHaveLength(0);
  });

  it('does not flag an object younger than the retention window (still mid-upload)', async () => {
    const key = `pm/pm_record/rec-1/${tsMsHoursAgo(1)}-recent.jpg`;
    const repo = makeRepo();
    const provider = makeProvider({ list: vi.fn().mockResolvedValue([key]) });
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanObjects('pm', 24);

    expect(findings).toHaveLength(0);
  });
});

describe('OrphanCleanupService.detectOrphanRows - orphan row (object missing)', () => {
  it('flags an ACTIVE row whose object no longer exists in storage', async () => {
    const row = makeAttachment({ status: 'ACTIVE', updatedAt: isoHoursAgo(48) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const provider = makeProvider({ exists: vi.fn().mockResolvedValue(false) });
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'ORPHAN_ROW', attachmentId: row.id, recommendedAction: 'DELETE_ROW' });
  });

  it('does not flag a row whose object still exists', async () => {
    const row = makeAttachment({ status: 'ACTIVE', updatedAt: isoHoursAgo(48) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const provider = makeProvider({ exists: vi.fn().mockResolvedValue(true) });
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(0);
  });
});

describe('OrphanCleanupService.detectOrphanRows - abandoned direct upload', () => {
  it('flags a placeholder row (sizeBytes 0, checksum null) past the retention window', async () => {
    const row = makeAttachment({ status: 'ACTIVE', sizeBytes: 0, checksum: null, createdAt: isoHoursAgo(48) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const provider = makeProvider();
    const service = new OrphanCleanupService(repo, provider);

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'ABANDONED_UPLOAD', attachmentId: row.id, recommendedAction: 'DELETE_ROW' });
    // Never checks object existence for this case - the object was never confirmed to exist.
    expect(provider.exists).not.toHaveBeenCalled();
  });

  it('does not flag a fresh placeholder row still within the retention window', async () => {
    const row = makeAttachment({ status: 'ACTIVE', sizeBytes: 0, checksum: null, createdAt: isoHoursAgo(1) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const service = new OrphanCleanupService(repo, makeProvider());

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(0);
  });
});

describe('OrphanCleanupService.detectOrphanRows - failed archive', () => {
  it('recommends RETRY_ARCHIVE for a row stuck past the age window with attempts remaining', async () => {
    const row = makeAttachment({ status: 'ARCHIVING', archiveAttempts: 1, lastArchiveAttemptAt: isoHoursAgo(48) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const service = new OrphanCleanupService(repo, makeProvider());

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'FAILED_ARCHIVE', recommendedAction: 'RETRY_ARCHIVE' });
  });

  it('recommends MANUAL_REVIEW once the retry budget is exhausted, regardless of age', async () => {
    const row = makeAttachment({ status: 'ARCHIVE_PENDING', archiveAttempts: 5, lastArchiveAttemptAt: isoHoursAgo(1) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([row]) } as any);
    const service = new OrphanCleanupService(repo, makeProvider());

    const findings = await service.detectOrphanRows('pm', 24);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'FAILED_ARCHIVE', recommendedAction: 'MANUAL_REVIEW' });
  });
});

describe('OrphanCleanupService.cleanup - dry run', () => {
  it('never deletes anything and marks every finding SKIPPED when dryRun is true', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new OrphanCleanupService(repo, provider);
    const report = {
      module: 'pm',
      scannedAt: NOW.toISOString(),
      retentionHours: 24,
      findings: [
        { kind: 'ORPHAN_OBJECT' as const, attachmentId: null, objectKey: 'pm/x.jpg', provider: 'CLOUDFLARE_R2' as const, ageHours: 48, reason: 'x', recommendedAction: 'DELETE_OBJECT' as const },
        { kind: 'ABANDONED_UPLOAD' as const, attachmentId: 'a1', objectKey: null, provider: 'CLOUDFLARE_R2' as const, ageHours: 48, reason: 'x', recommendedAction: 'DELETE_ROW' as const },
      ],
      summary: { orphanObjectCount: 1, orphanRowCount: 1, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    };

    const result = await service.cleanup(report, { dryRun: true });

    expect(provider.delete).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
    expect(result.actions.every((a) => a.outcome === 'SKIPPED')).toBe(true);
    expect(result.report.summary.skippedCount).toBe(2);
    expect(result.report.summary.cleanupCount).toBe(0);
  });

  it('never acts on a MANUAL_REVIEW finding even when dryRun is false', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new OrphanCleanupService(repo, provider);
    const report = {
      module: 'pm',
      scannedAt: NOW.toISOString(),
      retentionHours: 24,
      findings: [
        { kind: 'FAILED_RESTORE' as const, attachmentId: 'a1', objectKey: null, provider: 'GOOGLE_DRIVE' as const, ageHours: 48, reason: 'x', recommendedAction: 'MANUAL_REVIEW' as const },
      ],
      summary: { orphanObjectCount: 0, orphanRowCount: 1, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    };

    const result = await service.cleanup(report, { dryRun: false });

    expect(repo.delete).not.toHaveBeenCalled();
    expect(provider.delete).not.toHaveBeenCalled();
    expect(result.actions[0].outcome).toBe('SKIPPED');
  });
});

describe('OrphanCleanupService.cleanup - safe cleanup mode', () => {
  it('deletes the object for a DELETE_OBJECT finding when dryRun is false', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new OrphanCleanupService(repo, provider);
    const report = {
      module: 'pm',
      scannedAt: NOW.toISOString(),
      retentionHours: 24,
      findings: [
        { kind: 'ORPHAN_OBJECT' as const, attachmentId: null, objectKey: 'pm/x.jpg', provider: 'CLOUDFLARE_R2' as const, ageHours: 48, reason: 'x', recommendedAction: 'DELETE_OBJECT' as const },
      ],
      summary: { orphanObjectCount: 1, orphanRowCount: 0, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    };

    const result = await service.cleanup(report, { dryRun: false });

    expect(provider.delete).toHaveBeenCalledWith('pm/x.jpg');
    expect(result.actions[0].outcome).toBe('CLEANED');
    expect(result.report.summary.cleanupCount).toBe(1);
  });

  it('deletes the row for a DELETE_ROW finding when dryRun is false', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new OrphanCleanupService(repo, provider);
    const report = {
      module: 'pm',
      scannedAt: NOW.toISOString(),
      retentionHours: 24,
      findings: [
        { kind: 'ABANDONED_UPLOAD' as const, attachmentId: 'a1', objectKey: null, provider: 'CLOUDFLARE_R2' as const, ageHours: 48, reason: 'x', recommendedAction: 'DELETE_ROW' as const },
      ],
      summary: { orphanObjectCount: 0, orphanRowCount: 1, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    };

    const result = await service.cleanup(report, { dryRun: false });

    expect(repo.delete).toHaveBeenCalledWith('a1');
    expect(result.actions[0].outcome).toBe('CLEANED');
  });

  it('records a FAILED outcome when the delete itself throws', async () => {
    const repo = makeRepo();
    const provider = makeProvider({ delete: vi.fn().mockRejectedValue(new Error('network error')) });
    const service = new OrphanCleanupService(repo, provider);
    const report = {
      module: 'pm',
      scannedAt: NOW.toISOString(),
      retentionHours: 24,
      findings: [
        { kind: 'ORPHAN_OBJECT' as const, attachmentId: null, objectKey: 'pm/x.jpg', provider: 'CLOUDFLARE_R2' as const, ageHours: 48, reason: 'x', recommendedAction: 'DELETE_OBJECT' as const },
      ],
      summary: { orphanObjectCount: 1, orphanRowCount: 0, cleanupCount: 0, skippedCount: 0, failedCleanupCount: 0 },
    };

    const result = await service.cleanup(report, { dryRun: false });

    expect(result.actions[0].outcome).toBe('FAILED');
    expect(result.actions[0].error).toBe('network error');
    expect(result.report.summary.failedCleanupCount).toBe(1);
  });
});

describe('OrphanCleanupService.generateReport', () => {
  it('combines object and row findings into one report with correct summary counts', async () => {
    const key = `pm/pm_record/rec-1/${tsMsHoursAgo(48)}-orphaned.jpg`;
    const abandonedRow = makeAttachment({ id: 'a2', status: 'ACTIVE', sizeBytes: 0, checksum: null, createdAt: isoHoursAgo(48) });
    const repo = makeRepo({ listAllForModule: vi.fn().mockResolvedValue([abandonedRow]) } as any);
    const provider = makeProvider({ list: vi.fn().mockResolvedValue([key]) });
    const service = new OrphanCleanupService(repo, provider);

    const report = await service.generateReport('pm', 24);

    expect(report.summary.orphanObjectCount).toBe(1);
    expect(report.summary.orphanRowCount).toBe(1);
    expect(report.findings).toHaveLength(2);
  });
});
