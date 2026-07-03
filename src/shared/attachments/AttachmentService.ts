import { createHash } from 'crypto';
import { AttachmentRepository } from './AttachmentRepository';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { StorageProvider } from './StorageProvider';
import { Attachment, AttachmentUrl, UploadAttachmentInput } from './types';

const MAX_ARCHIVE_ATTEMPTS = 5;

/** Whether a successfully-archived attachment's Supabase Storage copy is
 *  deleted once verified against Drive (see ADR-010's Archive Flow: "Delete
 *  Supabase Object (configurable)"). One named constant, not inlined, so a
 *  future per-module override is a one-line change here rather than a
 *  scattered find-and-replace. */
const DELETE_SOURCE_AFTER_VERIFIED_ARCHIVE = true;

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildStoragePath(module: string, entityType: string, entityId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${module}/${entityType}/${entityId}/${Date.now()}-${safeName}`;
}

/**
 * The one door every module goes through for file storage (ADR-010,
 * "Why Provider Independence") - Machine360 and every business module call
 * only these methods, never `SupabaseStorageProvider`/
 * `GoogleDriveStorageProvider` (or the Supabase Storage/Google Drive SDKs)
 * directly. See `docs/engineering/ATTACHMENT_FRAMEWORK.md`.
 */
export class AttachmentService {
  constructor(
    private readonly repo: AttachmentRepository = new AttachmentRepository(),
    private readonly primary: StorageProvider = new SupabaseStorageProvider(),
    private readonly archiveProvider: StorageProvider = new GoogleDriveStorageProvider()
  ) {}

  async upload(input: UploadAttachmentInput): Promise<Attachment> {
    const path = buildStoragePath(input.module, input.entityType, input.entityId, input.filename);
    const stored = await this.primary.upload({ path, buffer: input.buffer, mimeType: input.mimeType });
    return this.repo.create({
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      attachmentType: input.attachmentType,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      storagePath: stored.locator,
      createdBy: input.createdBy ?? null,
    });
  }

  async delete(id: string): Promise<void> {
    const attachment = await this.repo.getById(id);
    if (!attachment) return;
    const onDrive = attachment.storageProvider === 'GOOGLE_DRIVE';
    const provider = onDrive ? this.archiveProvider : this.primary;
    const locator = onDrive ? attachment.driveFileId : attachment.storagePath;
    if (locator) await provider.delete(locator);
    await this.repo.delete(id);
  }

  async list(module: string, entityType: string, entityId: string): Promise<Attachment[]> {
    return this.repo.listByEntity(module, entityType, entityId);
  }

  async getUrl(id: string): Promise<AttachmentUrl | null> {
    const attachment = await this.repo.getById(id);
    if (!attachment) return null;
    if (attachment.status === 'ARCHIVED' && attachment.driveUrl) {
      return { url: attachment.driveUrl, expiresAt: null };
    }
    if (!attachment.storagePath) return null;
    const { url, expiresAt } = await this.primary.getUrl(attachment.storagePath, attachment.mimeType);
    return { url, expiresAt };
  }

  async verifyChecksum(id: string): Promise<boolean> {
    const attachment = await this.repo.getById(id);
    if (!attachment || !attachment.checksum) return false;
    const onDrive = attachment.storageProvider === 'GOOGLE_DRIVE';
    const provider = onDrive ? this.archiveProvider : this.primary;
    const locator = onDrive ? attachment.driveFileId : attachment.storagePath;
    if (!locator) return false;
    const buffer = await provider.download(locator);
    return sha256Hex(buffer) === attachment.checksum;
  }

  /** Marks the owning business record's lifecycle as complete - starts the
   *  module's retention clock (`attachment_retention_policies`). A module
   *  calls this once, when its own record reaches a terminal state (e.g. a
   *  PM record saved, an MQR closed) - never inferred by the platform
   *  itself. */
  async markBusinessComplete(id: string, completedAt: string = new Date().toISOString()): Promise<void> {
    await this.repo.markBusinessCompleted(id, completedAt);
  }

  /** Archive flow step 1: ACTIVE -> ARCHIVE_PENDING for every attachment
   *  whose module has a configured (non-null) retention window and has
   *  aged past it. Retention days are read from `attachment_retention_policies`,
   *  never hardcoded here - a module with `retentionDays: null` (NTR today)
   *  is permanently excluded. */
  async enqueueArchiveEligible(module: string): Promise<number> {
    const policy = await this.repo.getRetentionPolicy(module);
    if (!policy || policy.retentionDays === null) return 0;
    const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const eligible = await this.repo.listArchiveEligible(module, cutoff);
    for (const attachment of eligible) await this.repo.markArchivePending(attachment.id);
    return eligible.length;
  }

  /** Archive flow step 2: moves ARCHIVE_PENDING rows to Google Drive,
   *  verifies checksum + size against the original, and only then marks
   *  ARCHIVED. Never deletes the Supabase copy before that verification
   *  succeeds (ADR-010: "never delete a file before successful
   *  verification"). A failure leaves the row ARCHIVE_PENDING with
   *  `archiveAttempts` incremented for retry on the next call, up to
   *  `MAX_ARCHIVE_ATTEMPTS`. */
  async processArchiveQueue(): Promise<{ archived: number; failed: number }> {
    const pending = await this.repo.listByStatus('ARCHIVE_PENDING');
    let archived = 0;
    let failed = 0;
    for (const attachment of pending) {
      if (attachment.archiveAttempts >= MAX_ARCHIVE_ATTEMPTS) continue;
      try {
        await this.repo.markArchiving(attachment.id);
        if (!attachment.storagePath) throw new Error('Attachment has no active storage_path to archive');
        const buffer = await this.primary.download(attachment.storagePath);
        const stored = await this.archiveProvider.upload({ path: attachment.filename, buffer, mimeType: attachment.mimeType });
        if (stored.sizeBytes !== attachment.sizeBytes || (attachment.checksum && stored.checksum !== attachment.checksum)) {
          throw new Error("Archived copy failed checksum/size verification against the original");
        }
        await this.repo.markArchived(attachment.id, {
          driveFileId: stored.locator,
          driveUrl: stored.url ?? '',
          archivedAt: new Date().toISOString(),
        });
        if (DELETE_SOURCE_AFTER_VERIFIED_ARCHIVE) {
          await this.primary.delete(attachment.storagePath);
          await this.repo.clearStorageAfterArchive(attachment.id);
        }
        archived++;
      } catch (err) {
        await this.repo.recordArchiveFailure(attachment.id, {
          attempts: attachment.archiveAttempts + 1,
          error: err instanceof Error ? err.message : String(err),
          attemptAt: new Date().toISOString(),
        });
        failed++;
      }
    }
    return { archived, failed };
  }

  /** Restores an archived attachment's bytes back into Supabase Storage as
   *  primary (e.g. a module needs to re-process a file after archiving). */
  async restore(id: string): Promise<Attachment> {
    const attachment = await this.repo.getById(id);
    if (!attachment) throw new Error(`Attachment ${id} not found`);
    if (attachment.status !== 'ARCHIVED' || !attachment.driveFileId) {
      throw new Error(`Attachment ${id} is not archived - nothing to restore`);
    }
    const buffer = await this.archiveProvider.download(attachment.driveFileId);
    const path = buildStoragePath(attachment.module, attachment.entityType, attachment.entityId, attachment.filename);
    const stored = await this.primary.upload({ path, buffer, mimeType: attachment.mimeType });
    await this.repo.restoreToActive(id, stored.locator);
    return (await this.repo.getById(id))!;
  }
}
