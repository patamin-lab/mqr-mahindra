import { getSupabase } from '@/lib/supabase';
import {
  NtrImportSessionRepository,
  NtrImportSessionCreateInput,
  NtrImportSessionUpdateInput,
} from './ntrImportSessionRepository';
import { NtrImportSession } from '../types';

const IMPORT_SESSION_LIST_MAX = 100;

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
        original_file_url: input.originalFileUrl,
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
      .select('*')
      .order('started_at', { ascending: false })
      .limit(Math.min(limit, IMPORT_SESSION_LIST_MAX));
    if (error) throw error;
    return (data ?? []) as NtrImportSession[];
  }
}
