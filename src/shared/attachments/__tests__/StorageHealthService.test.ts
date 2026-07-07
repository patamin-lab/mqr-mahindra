import { describe, it, expect, vi } from 'vitest';
import { StorageHealthService } from '../StorageHealthService';
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AttachmentRepository> = {}): AttachmentRepository {
  return {
    listAllForModule: vi.fn().mockResolvedValue([]),
    listByStatus: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as AttachmentRepository;
}

function makeProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    name: 'CLOUDFLARE_R2',
    upload: vi.fn().mockResolvedValue({ locator: 'health/probe', checksum: 'x', sizeBytes: 10, url: null }),
    download: vi.fn().mockResolvedValue(Buffer.from('ok')),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn(),
    getSignedUrl: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

describe('StorageHealthService.checkHealth', () => {
  it('reports UP with latency figures on a successful probe', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.status).toBe('UP');
    expect(report.provider).toBe('CLOUDFLARE_R2');
    expect(report.uploadLatencyMs).not.toBeNull();
    expect(report.downloadLatencyMs).not.toBeNull();
    expect(report.error).toBeNull();
    expect(provider.delete).toHaveBeenCalledWith('health/probe');
  });

  it('reports DOWN and captures the error when the probe throws', async () => {
    const repo = makeRepo();
    const provider = makeProvider({ upload: vi.fn().mockRejectedValue(new Error('bucket unreachable')) });
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.status).toBe('DOWN');
    expect(report.error).toBe('bucket unreachable');
    expect(report.uploadLatencyMs).toBeNull();
  });

  it('still cleans up the probe object even if download fails', async () => {
    const repo = makeRepo();
    const provider = makeProvider({ download: vi.fn().mockRejectedValue(new Error('download failed')) });
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.status).toBe('DOWN');
    expect(provider.delete).toHaveBeenCalledWith('health/probe');
  });

  it('computes archiveErrorRate from ARCHIVE_PENDING/ARCHIVING rows with archive_error set', async () => {
    const repo = makeRepo({
      listByStatus: vi.fn().mockImplementation((status: string) => {
        if (status === 'ARCHIVE_PENDING') {
          return Promise.resolve([
            makeAttachment({ id: 'p1', status: 'ARCHIVE_PENDING', archiveError: 'boom' }),
            makeAttachment({ id: 'p2', status: 'ARCHIVE_PENDING', archiveError: null }),
          ]);
        }
        return Promise.resolve([]);
      }),
    } as any);
    const provider = makeProvider();
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.archiveErrorRate).toBe(0.5);
  });

  it('returns a null archiveErrorRate when nothing is currently in the archive queue', async () => {
    const repo = makeRepo();
    const provider = makeProvider();
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.archiveErrorRate).toBeNull();
  });

  it('scopes storageUsageBytes to rows matching the probed provider within the given module', async () => {
    const repo = makeRepo({
      listAllForModule: vi.fn().mockResolvedValue([
        makeAttachment({ id: 'r1', storageProvider: 'CLOUDFLARE_R2', sizeBytes: 100 }),
        makeAttachment({ id: 'r2', storageProvider: 'GOOGLE_DRIVE', sizeBytes: 999 }),
      ]),
    } as any);
    const provider = makeProvider();
    const service = new StorageHealthService(repo);

    const report = await service.checkHealth(provider, 'pm');

    expect(report.storageUsageBytes).toBe(100);
  });
});
