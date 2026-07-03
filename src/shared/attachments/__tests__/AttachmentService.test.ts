import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentService } from '../AttachmentService';
import { AttachmentRepository } from '../AttachmentRepository';
import { StorageProvider } from '../StorageProvider';
import { Attachment } from '../types';

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
    storageProvider: 'SUPABASE',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(): AttachmentRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByEntity: vi.fn(),
    delete: vi.fn(),
    markBusinessCompleted: vi.fn(),
    listArchiveEligible: vi.fn(),
    listByStatus: vi.fn(),
    markArchivePending: vi.fn(),
    markArchiving: vi.fn(),
    markArchived: vi.fn(),
    recordArchiveFailure: vi.fn(),
    clearStorageAfterArchive: vi.fn(),
    restoreToActive: vi.fn(),
    getRetentionPolicy: vi.fn(),
  } as unknown as AttachmentRepository;
}

function makeProvider(name: 'SUPABASE' | 'GOOGLE_DRIVE'): StorageProvider {
  return {
    name,
    upload: vi.fn(),
    delete: vi.fn(),
    download: vi.fn(),
    getUrl: vi.fn(),
  };
}

describe('AttachmentService.upload', () => {
  it('uploads to the primary provider and persists a row with its checksum/size', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    (primary.upload as any).mockResolvedValue({ locator: 'pm/pm_record/rec-1/1-photo.jpg', checksum: 'abc123', sizeBytes: 100, url: null });
    (repo.create as any).mockResolvedValue(makeAttachment());
    const service = new AttachmentService(repo, primary, makeProvider('GOOGLE_DRIVE'));

    const result = await service.upload({
      module: 'pm',
      entityType: 'pm_record',
      entityId: 'rec-1',
      attachmentType: 'ReportPhoto',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('x'),
    });

    expect(primary.upload).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ checksum: 'abc123', sizeBytes: 100 }));
    expect(result.id).toBe('a1');
  });
});

describe('AttachmentService.delete', () => {
  it('deletes from Supabase when the attachment is still ACTIVE', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    const archive = makeProvider('GOOGLE_DRIVE');
    (repo.getById as any).mockResolvedValue(makeAttachment());
    const service = new AttachmentService(repo, primary, archive);

    await service.delete('a1');

    expect(primary.delete).toHaveBeenCalledWith('pm/pm_record/rec-1/1-photo.jpg');
    expect(archive.delete).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalledWith('a1');
  });

  it('deletes from Google Drive when the attachment has already been archived', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    const archive = makeProvider('GOOGLE_DRIVE');
    (repo.getById as any).mockResolvedValue(makeAttachment({ status: 'ARCHIVED', storageProvider: 'GOOGLE_DRIVE', storagePath: null, driveFileId: 'drive-1' }));
    const service = new AttachmentService(repo, primary, archive);

    await service.delete('a1');

    expect(archive.delete).toHaveBeenCalledWith('drive-1');
    expect(primary.delete).not.toHaveBeenCalled();
  });
});

describe('AttachmentService.getUrl', () => {
  it('returns the Drive share link directly for an archived attachment', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    (repo.getById as any).mockResolvedValue(makeAttachment({ status: 'ARCHIVED', driveUrl: 'https://drive.google.com/file/d/drive-1/view' }));
    const service = new AttachmentService(repo, primary, makeProvider('GOOGLE_DRIVE'));

    const result = await service.getUrl('a1');

    expect(result).toEqual({ url: 'https://drive.google.com/file/d/drive-1/view', expiresAt: null });
    expect(primary.getUrl).not.toHaveBeenCalled();
  });

  it('requests a signed URL from Supabase for an active attachment', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    (primary.getUrl as any).mockResolvedValue({ url: 'https://signed.example/x', expiresAt: '2026-01-01T01:00:00.000Z' });
    (repo.getById as any).mockResolvedValue(makeAttachment());
    const service = new AttachmentService(repo, primary, makeProvider('GOOGLE_DRIVE'));

    const result = await service.getUrl('a1');

    expect(primary.getUrl).toHaveBeenCalledWith('pm/pm_record/rec-1/1-photo.jpg', 'image/jpeg');
    expect(result?.url).toBe('https://signed.example/x');
  });
});

describe('AttachmentService.enqueueArchiveEligible', () => {
  it('does nothing for a module with no retention policy (never auto-archive)', async () => {
    const repo = makeRepo();
    (repo.getRetentionPolicy as any).mockResolvedValue({ module: 'ntr', retentionDays: null });
    const service = new AttachmentService(repo, makeProvider('SUPABASE'), makeProvider('GOOGLE_DRIVE'));

    const count = await service.enqueueArchiveEligible('ntr');

    expect(count).toBe(0);
    expect(repo.listArchiveEligible).not.toHaveBeenCalled();
  });

  it('marks every eligible attachment ARCHIVE_PENDING for a module with a retention window', async () => {
    const repo = makeRepo();
    (repo.getRetentionPolicy as any).mockResolvedValue({ module: 'pm', retentionDays: 730 });
    (repo.listArchiveEligible as any).mockResolvedValue([makeAttachment({ id: 'a1' }), makeAttachment({ id: 'a2' })]);
    const service = new AttachmentService(repo, makeProvider('SUPABASE'), makeProvider('GOOGLE_DRIVE'));

    const count = await service.enqueueArchiveEligible('pm');

    expect(count).toBe(2);
    expect(repo.markArchivePending).toHaveBeenCalledWith('a1');
    expect(repo.markArchivePending).toHaveBeenCalledWith('a2');
  });
});

describe('AttachmentService.processArchiveQueue', () => {
  let repo: AttachmentRepository;
  let primary: StorageProvider;
  let archive: StorageProvider;
  let service: AttachmentService;

  beforeEach(() => {
    repo = makeRepo();
    primary = makeProvider('SUPABASE');
    archive = makeProvider('GOOGLE_DRIVE');
    service = new AttachmentService(repo, primary, archive);
  });

  it('archives a verified attachment and deletes the Supabase copy', async () => {
    (repo.listByStatus as any).mockResolvedValue([makeAttachment({ status: 'ARCHIVE_PENDING' })]);
    (primary.download as any).mockResolvedValue(Buffer.from('bytes'));
    (archive.upload as any).mockResolvedValue({ locator: 'drive-1', checksum: 'abc123', sizeBytes: 100, url: 'https://drive/x' });

    const result = await service.processArchiveQueue();

    expect(result).toEqual({ archived: 1, failed: 0 });
    expect(repo.markArchived).toHaveBeenCalledWith('a1', expect.objectContaining({ driveFileId: 'drive-1' }));
    expect(primary.delete).toHaveBeenCalledWith('pm/pm_record/rec-1/1-photo.jpg');
    expect(repo.recordArchiveFailure).not.toHaveBeenCalled();
  });

  it('never deletes the Supabase copy when checksum verification fails, and records the failure for retry', async () => {
    (repo.listByStatus as any).mockResolvedValue([makeAttachment({ status: 'ARCHIVE_PENDING' })]);
    (primary.download as any).mockResolvedValue(Buffer.from('bytes'));
    (archive.upload as any).mockResolvedValue({ locator: 'drive-1', checksum: 'WRONG', sizeBytes: 100, url: 'https://drive/x' });

    const result = await service.processArchiveQueue();

    expect(result).toEqual({ archived: 0, failed: 1 });
    expect(repo.markArchived).not.toHaveBeenCalled();
    expect(primary.delete).not.toHaveBeenCalled();
    expect(repo.recordArchiveFailure).toHaveBeenCalledWith('a1', expect.objectContaining({ attempts: 1 }));
  });

  it('skips an attachment that has already exhausted its retry budget', async () => {
    (repo.listByStatus as any).mockResolvedValue([makeAttachment({ status: 'ARCHIVE_PENDING', archiveAttempts: 5 })]);

    const result = await service.processArchiveQueue();

    expect(result).toEqual({ archived: 0, failed: 0 });
    expect(primary.download).not.toHaveBeenCalled();
  });
});

describe('AttachmentService.verifyChecksum', () => {
  it('recomputes the hash from whichever provider currently holds the bytes', async () => {
    const repo = makeRepo();
    const primary = makeProvider('SUPABASE');
    (primary.download as any).mockResolvedValue(Buffer.from('hello'));
    (repo.getById as any).mockResolvedValue(makeAttachment({ checksum: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' }));
    const service = new AttachmentService(repo, primary, makeProvider('GOOGLE_DRIVE'));

    const result = await service.verifyChecksum('a1');

    expect(result).toBe(true);
  });
});
