import { getSupabase } from '@/lib/supabase';
import {
  NtrImportSessionRepository,
  NtrImportSessionCreateInput,
  NtrImportSessionUpdateInput,
} from './ntrImportSessionRepository';
import { NtrImportSession } from '../types';

const IMPORT_SESSION_LIST_MAX = 100;

/** Every column except `file_content` - list views (session history, the
 *  Archive Queue) never need the base64 original file, only `getById()`
 *  (preview/commit re-validation, the archive step itself) does. Keeps the
 *  history/queue responses from shipping a multi-hundred-KB blob per row
 *  on every page load. */
const LIST_COLUMNS =
  'id, importer, filename, original_file_url, status, total_records, valid_count, duplicate_count, skipped_count, failed_count, errors, file_checksum, imported_at, archive_job_id, archive_attempts, last_archive_attempt_at, archive_error, archived_at, started_at, completed_at, created_by, updated_by, updated_at';

export class SupabaseNtrImportSessionRepository implements NtrImportSessionRepository {
  private readonly client = getSupabase();
  private readonly table = 'ntr_import_sessions';

  async create(input: NtrImportSessionCreateInput, actor: { username: string }): Promise<NtrImportSession> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from(this.table)
      .insert({
        importer: input.importer,
        filename: input.filename,
        file_content: input.fileContent,
        file_checksum: input.fileChecksum,
        status: 'Pending',
        total_records: input.totalRecords,
        valid_count: 0,
        duplicate_count: 0,
        skipped_count: 0,
        failed_count: 0,
        errors: [],
        started_at: now,
        created_by: actor.username,
        updated_by: actor.username,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as NtrImportSession;
  }

  async update(id: string, input: NtrImportSessionUpdateInput, actor: { username: string }): Promise<NtrImportSession> {
    const payload: Record<string, unknown> = {
      updated_by: actor.username,
      updated_at: new Date().toISOString(),
    };
    if (input.status !== undefined) payload.status = input.status;
    if (input.validCount !== undefined) payload.valid_count = input.validCount;
    if (input.duplicateCount !== undefined) payload.duplicate_count = input.duplicateCount;
    if (input.skippedCount !== undefined) payload.skipped_count = input.skippedCount;
    if (input.failedCount !== undefined) payload.failed_count = input.failedCount;
    if (input.errors !== undefined) payload.errors = input.errors;
    if (input.completedAt !== undefined) payload.completed_at = input.completedAt;
    if (input.importedAt !== undefined) payload.imported_at = input.importedAt;
    if (input.fileContent !== undefined) payload.file_content = input.fileContent;
    if (input.originalFileUrl !== undefined) payload.original_file_url = input.originalFileUrl;
    if (input.archiveJobId !== undefined) payload.archive_job_id = input.archiveJobId;
    if (input.archiveAttempts !== undefined) payload.archive_attempts = input.archiveAttempts;
    if (input.lastArchiveAttemptAt !== undefined) payload.last_archive_attempt_at = input.lastArchiveAttemptAt;
    if (input.archiveError !== undefined) payload.archive_error = input.archiveError;
    if (input.archivedAt !== undefined) payload.archived_at = input.archivedAt;

    const { data, error } = await this.client.from(this.table).update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data as NtrImportSession;
  }

  async getById(id: string): Promise<NtrImportSession | null> {
    const { data, error } = await this.client.from(this.table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as NtrImportSession) ?? null;
  }

  async list(limit = IMPORT_SESSION_LIST_MAX): Promise<NtrImportSession[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select(LIST_COLUMNS)
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, IMPORT_SESSION_LIST_MAX));
    if (error) throw error;
    return (data ?? []) as unknown as NtrImportSession[];
  }

  async listArchiveQueue(): Promise<NtrImportSession[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select(LIST_COLUMNS)
      .in('status', ['Archive Pending', 'Archive Failed'])
      .order('started_at', { ascending: false })
      .limit(IMPORT_SESSION_LIST_MAX);
    if (error) throw error;
    return (data ?? []) as unknown as NtrImportSession[];
  }
}
