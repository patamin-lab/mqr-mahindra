import { getSupabase } from '@/lib/supabase';
import { Attachment, AttachmentStatus, RetentionPolicy, StorageProviderName } from './types';

interface AttachmentRow {
  id: string;
  module: string;
  entity_type: string;
  entity_id: string;
  attachment_type: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  checksum: string | null;
  storage_provider: string;
  storage_path: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  status: string;
  archive_attempts: number;
  last_archive_attempt_at: string | null;
  archive_error: string | null;
  archived_at: string | null;
  business_completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    module: row.module,
    entityType: row.entity_type,
    entityId: row.entity_id,
    attachmentType: row.attachment_type as Attachment['attachmentType'],
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    checksum: row.checksum,
    storageProvider: row.storage_provider as StorageProviderName,
    storagePath: row.storage_path,
    driveFileId: row.drive_file_id,
    driveUrl: row.drive_url,
    status: row.status as AttachmentStatus,
    archiveAttempts: row.archive_attempts,
    lastArchiveAttemptAt: row.last_archive_attempt_at,
    archiveError: row.archive_error,
    archivedAt: row.archived_at,
    businessCompletedAt: row.business_completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateAttachmentRow {
  module: string;
  entityType: string;
  entityId: string;
  attachmentType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  storagePath: string;
  createdBy: string | null;
}

/** Persistence only - see `.claude/rules/01-architecture-boundaries.md`'s
 *  Repository/Service split. `AttachmentService` owns every decision about
 *  *when* a row transitions between archive states; this file only reads
 *  and writes rows. */
export class AttachmentRepository {
  async create(input: CreateAttachmentRow): Promise<Attachment> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        module: input.module,
        entity_type: input.entityType,
        entity_id: input.entityId,
        attachment_type: input.attachmentType,
        filename: input.filename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        checksum: input.checksum,
        storage_provider: 'SUPABASE',
        storage_path: input.storagePath,
        status: 'ACTIVE',
        created_by: input.createdBy,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create attachment: ${error?.message ?? 'no data'}`);
    return toAttachment(data as AttachmentRow);
  }

  async getById(id: string): Promise<Attachment | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('attachments').select().eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to load attachment ${id}: ${error.message}`);
    return data ? toAttachment(data as AttachmentRow) : null;
  }

  async listByEntity(module: string, entityType: string, entityId: string): Promise<Attachment[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('attachments')
      .select()
      .eq('module', module)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .neq('status', 'PURGED')
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to list attachments: ${error.message}`);
    return (data as AttachmentRow[]).map(toAttachment);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('attachments').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete attachment ${id}: ${error.message}`);
  }

  async markBusinessCompleted(id: string, completedAt: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('attachments').update({ business_completed_at: completedAt }).eq('id', id);
    if (error) throw new Error(`Failed to mark attachment ${id} business-complete: ${error.message}`);
  }

  /** Rows eligible to move ACTIVE -> ARCHIVE_PENDING: business-complete,
   *  past the module's retention window, per module (joined in application
   *  code - `attachment_retention_policies` is tiny and rarely changes, so
   *  a cross-table SQL join isn't worth the added query complexity here). */
  async listArchiveEligible(module: string, olderThan: string): Promise<Attachment[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('attachments')
      .select()
      .eq('module', module)
      .eq('status', 'ACTIVE')
      .not('business_completed_at', 'is', null)
      .lte('business_completed_at', olderThan);
    if (error) throw new Error(`Failed to list archive-eligible attachments: ${error.message}`);
    return (data as AttachmentRow[]).map(toAttachment);
  }

  async listByStatus(status: AttachmentStatus): Promise<Attachment[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('attachments').select().eq('status', status);
    if (error) throw new Error(`Failed to list attachments with status ${status}: ${error.message}`);
    return (data as AttachmentRow[]).map(toAttachment);
  }

  async markArchivePending(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('attachments').update({ status: 'ARCHIVE_PENDING' }).eq('id', id);
    if (error) throw new Error(`Failed to mark attachment ${id} archive-pending: ${error.message}`);
  }

  async markArchiving(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('attachments').update({ status: 'ARCHIVING' }).eq('id', id);
    if (error) throw new Error(`Failed to mark attachment ${id} archiving: ${error.message}`);
  }

  async markArchived(id: string, params: { driveFileId: string; driveUrl: string; archivedAt: string }): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('attachments')
      .update({
        status: 'ARCHIVED',
        storage_provider: 'GOOGLE_DRIVE',
        drive_file_id: params.driveFileId,
        drive_url: params.driveUrl,
        archived_at: params.archivedAt,
      })
      .eq('id', id);
    if (error) throw new Error(`Failed to mark attachment ${id} archived: ${error.message}`);
  }

  async recordArchiveFailure(id: string, params: { attempts: number; error: string; attemptAt: string }): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('attachments')
      .update({ status: 'ARCHIVE_PENDING', archive_attempts: params.attempts, archive_error: params.error, last_archive_attempt_at: params.attemptAt })
      .eq('id', id);
    if (error) throw new Error(`Failed to record archive failure for attachment ${id}: ${error.message}`);
  }

  async clearStorageAfterArchive(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from('attachments').update({ storage_path: null }).eq('id', id);
    if (error) throw new Error(`Failed to clear storage_path for attachment ${id}: ${error.message}`);
  }

  async restoreToActive(id: string, storagePath: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('attachments')
      .update({ status: 'ACTIVE', storage_provider: 'SUPABASE', storage_path: storagePath })
      .eq('id', id);
    if (error) throw new Error(`Failed to restore attachment ${id}: ${error.message}`);
  }

  async getRetentionPolicy(module: string): Promise<RetentionPolicy | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('attachment_retention_policies').select().eq('module', module).maybeSingle();
    if (error) throw new Error(`Failed to load retention policy for module ${module}: ${error.message}`);
    return data ? { module: data.module, retentionDays: data.retention_days } : null;
  }
}
