import { createHash } from 'crypto';
import { AttachmentRepository } from './AttachmentRepository';
import { StorageProviderFactory } from './StorageProviderFactory';
import { StorageProvider } from './StorageProvider';
import { Attachment, AttachmentUrl, UploadAttachmentInput } from './types';

/** Exported so `OrphanCleanupService` can identify a row stuck past this
 *  many retries as a "failed archive" finding, without duplicating the
 *  threshold as a second magic number. */
export const MAX_ARCHIVE_ATTEMPTS = 5;

/** Whether a successfully-archived attachment's Supabase Storage copy is
 *  deleted once verified against Drive (see ADR-010's Archive Flow: "Delete
 *  Supabase Object (configurable)"). One named constant, not inlined, so a
 *  future per-module override is a one-line change here rather than a
 *  scattered find-and-replace. */
const DELETE_SOURCE_AFTER_VERIFIED_ARCHIVE = true;

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Object-key hardening (R2 Production Readiness Review, Security §7): a
 *  path-like segment (`module`/`entityType`/`entityId`) must never be able
 *  to inject a `/` or `..` into the storage key - `/api/attachments`'s
 *  generic POST route accepts these as plain form-data strings from the
 *  client with only an empty-string check, so nothing upstream guarantees
 *  they're safe. Object storage has no real directory traversal (a key
 *  containing "../" doesn't escape the bucket the way a filesystem path
 *  would), but an unsanitized segment could still collide with another
 *  module's key prefix or corrupt `list()`/archive-folder scoping - this
 *  closes that off at the one place every caller's path is built, rather
 *  than trusting each caller to have already sanitized its own inputs. */
function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildStoragePath(module: string, entityType: string, entityId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${sanitizePathSegment(module)}/${sanitizePathSegment(entityType)}/${sanitizePathSegment(entityId)}/${Date.now()}-${safeName}`;
}

/**
 * The one door every module goes through for file storage (ADR-010,
 * "Why Provider Independence") - Machine360 and every business module call
 * only these methods, never a `StorageProvider` implementation (or the
 * Supabase Storage/Google Drive/R2 SDKs) directly. `primary`/`archiveProvider`
 * are constructed via `StorageProviderFactory` (config-driven -
 * `STORAGE_PROVIDER`/`ARCHIVE_PROVIDER`), never hardcoded to a specific
 * class here - see `docs/architecture/STORAGE_PLATFORM.md`. Callers that
 * need a specific provider (tests, mainly) still just pass it in - this
 * class never cared which concrete provider it got, only that it
 * implements `StorageProvider`.
 */
export class AttachmentService {
  constructor(
    private readonly repo: AttachmentRepository = new AttachmentRepository(),
    private readonly primary: StorageProvider = StorageProviderFactory.createPrimaryProvider(),
    private readonly archiveProvider: StorageProvider = StorageProviderFactory.createArchiveProvider()
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
      storageProvider: this.primary.name,
    });
  }

  /** Step 1 of a direct (browser-to-storage) upload - the Attachment
   *  Platform's equivalent of `initResumableUpload()`, for files large
   *  enough that a single-shot POST through our own API route would hit
   *  Vercel's request-body cap. Pre-creates the row (`sizeBytes: 0`,
   *  `checksum: null`) so callers have an attachment ID to reference
   *  immediately (e.g. to build a preview list before the upload
   *  finishes) - `finalizeDirectUpload()` confirms the bytes actually
   *  landed before anything downstream (archive, display) trusts it. */
  async initDirectUpload(input: Omit<UploadAttachmentInput, 'buffer'>): Promise<{ attachmentId: string; uploadUrl: string; token: string }> {
    if (!this.primary.createSignedUploadUrl) throw new Error('Primary storage provider does not support direct upload');
    const path = buildStoragePath(input.module, input.entityType, input.entityId, input.filename);
    const { signedUrl, token } = await this.primary.createSignedUploadUrl(path);
    const attachment = await this.repo.create({
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      attachmentType: input.attachmentType,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: 0,
      checksum: null,
      storagePath: path,
      createdBy: input.createdBy ?? null,
      storageProvider: this.primary.name,
    });
    return { attachmentId: attachment.id, uploadUrl: signedUrl, token };
  }

  /** Step 2: called once the browser's direct PUT to the signed URL
   *  reports success - confirms the object actually exists in storage
   *  (never trusts the client's word alone) and records its real size.
   *  Checksum is intentionally left null for this path (no server-side
   *  copy of the bytes to hash) - `processArchiveQueue()` already treats
   *  a null `checksum` as "nothing to verify against" rather than a
   *  mismatch. */
  async finalizeDirectUpload(attachmentId: string): Promise<Attachment> {
    const attachment = await this.repo.getById(attachmentId);
    if (!attachment || !attachment.storagePath) throw new Error(`Attachment ${attachmentId} not found`);
    if (!this.primary.statObject) throw new Error('Primary storage provider does not support direct upload finalize');
    const stat = await this.primary.statObject(attachment.storagePath);
    if (!stat) throw new Error('Uploaded file was not found in storage - the upload may not have completed');
    await this.repo.updateAfterDirectUpload(attachmentId, stat.sizeBytes);
    return (await this.repo.getById(attachmentId))!;
  }

  /** Re-tags a batch of attachments (uploaded against a temporary,
   *  client-generated entity ID before their owning record existed) with
   *  the record's real ID once saved - see `AttachmentRepository.reassignEntity()`. */
  async reassignEntity(ids: string[], entityId: string): Promise<void> {
    await this.repo.reassignEntity(ids, entityId);
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

  /** Raw row lookup - used by API routes that must check Dealer/Branch
   *  Scope against the owning record (`resolveAttachmentAccess.ts`) before
   *  deciding whether to serve/delete/reassign an attachment ID. */
  async getById(id: string): Promise<Attachment | null> {
    return this.repo.getById(id);
  }

  async getUrl(id: string): Promise<AttachmentUrl | null> {
    const attachment = await this.repo.getById(id);
    if (!attachment) return null;
    if (attachment.status === 'ARCHIVED' && attachment.driveUrl) {
      return { url: attachment.driveUrl, expiresAt: null };
    }
    if (!attachment.storagePath) return null;
    const { url, expiresAt } = await this.primary.getSignedUrl(attachment.storagePath, attachment.mimeType);
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
          storageProvider: this.archiveProvider.name,
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
    await this.repo.restoreToActive(id, stored.locator, this.primary.name);
    return (await this.repo.getById(id))!;
  }
}
