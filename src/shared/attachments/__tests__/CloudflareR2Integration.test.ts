import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'crypto';

/**
 * Integration test for the metadata-integrity fix: uploads a real object
 * through `CloudflareR2Provider` (S3 client mocked - no live R2 bucket
 * needed for `npm test`, matching this repo's existing convention of
 * always mocking `@/lib/supabase` rather than hitting a live DB) and
 * asserts the row `AttachmentRepository` actually writes has
 * `storage_provider === 'CLOUDFLARE_R2'` - not the previously-hardcoded
 * `'SUPABASE'` literal. Exercises `AttachmentService` + `AttachmentRepository`
 * + `CloudflareR2Provider` wired together, not each mocked individually at
 * the `AttachmentService` boundary the way `AttachmentService.test.ts` does.
 */

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createInsertCapturingBuilder() {
  let insertedPayload: Record<string, unknown> | null = null;
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    insertedPayload = payload;
    return builder;
  });
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(async (): Promise<QueryResult> => {
    // Echoes back what a real Postgres insert + RETURNING * would give:
    // every column the caller sent, plus DB-generated fields.
    return {
      data: {
        id: 'attachment-1',
        entity_type: insertedPayload!.entity_type,
        entity_id: insertedPayload!.entity_id,
        module: insertedPayload!.module,
        attachment_type: insertedPayload!.attachment_type,
        filename: insertedPayload!.filename,
        mime_type: insertedPayload!.mime_type,
        size_bytes: insertedPayload!.size_bytes,
        checksum: insertedPayload!.checksum,
        storage_provider: insertedPayload!.storage_provider,
        storage_path: insertedPayload!.storage_path,
        drive_file_id: null,
        drive_url: null,
        status: 'ACTIVE',
        archive_attempts: 0,
        last_archive_attempt_at: null,
        archive_error: null,
        archived_at: null,
        business_completed_at: null,
        created_by: insertedPayload!.created_by,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    };
  });
  return { builder, getInsertedPayload: () => insertedPayload };
}

const { builder: attachmentsBuilder, getInsertedPayload } = createInsertCapturingBuilder();

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: (table: string) => (table === 'attachments' ? attachmentsBuilder : undefined) }),
  STORAGE_BUCKET: 'mqr-files',
}));

const { AttachmentService } = await import('../AttachmentService');
const { AttachmentRepository } = await import('../AttachmentRepository');
const { CloudflareR2Provider } = await import('../CloudflareR2Provider');
const { GoogleDriveStorageProvider } = await import('../GoogleDriveStorageProvider');

describe('Cloudflare R2 upload -> database row integration', () => {
  it('persists storage_provider = CLOUDFLARE_R2 when CloudflareR2Provider is the primary provider', async () => {
    const fakeS3Client = { send: vi.fn().mockResolvedValue({}) };
    const r2 = new CloudflareR2Provider(
      { accountId: 'acct-1', accessKeyId: 'key-1', secretAccessKey: 'secret-1', bucket: 'test-bucket' },
      fakeS3Client as any
    );
    const service = new AttachmentService(new AttachmentRepository(), r2, new GoogleDriveStorageProvider());

    const attachment = await service.upload({
      module: 'pm',
      entityType: 'pm_record',
      entityId: 'rec-1',
      attachmentType: 'ReportPhoto',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('hello'),
      createdBy: 'integration-test',
    });

    // The object genuinely went through CloudflareR2Provider.upload() -> PutObjectCommand.
    expect(fakeS3Client.send).toHaveBeenCalledTimes(1);

    // The row AttachmentRepository actually wrote (captured from the real
    // insert() call, not asserted against AttachmentService's in-memory
    // return value alone) records the true provider.
    const insertedPayload = getInsertedPayload();
    expect(insertedPayload?.storage_provider).toBe('CLOUDFLARE_R2');
    expect(insertedPayload?.checksum).toBe(createHash('sha256').update('hello').digest('hex'));
    expect(insertedPayload?.mime_type).toBe('image/jpeg');
    expect(insertedPayload?.size_bytes).toBe(5);

    // And what the service hands back to the caller matches the database.
    expect(attachment.storageProvider).toBe('CLOUDFLARE_R2');

    // R2 Production Readiness Review hardening: only provider/object_key/
    // metadata are ever persisted - never a signed or permanent URL. The
    // insert payload has no url-shaped field at all, and storage_path is
    // the bare object key, never a URL.
    expect(insertedPayload).not.toHaveProperty('url');
    expect(insertedPayload).not.toHaveProperty('public_url');
    expect(insertedPayload).not.toHaveProperty('drive_url');
    expect(insertedPayload?.storage_path).not.toMatch(/^https?:\/\//);
  });
});
