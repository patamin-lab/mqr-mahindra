/**
 * PM Record — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase` (same
 * pattern every other table in `src/lib/db.ts` uses) rather than creating
 * a second Supabase client/connection. Every method is a stub: no
 * `pm_records` table exists yet, and per this repo's existing convention
 * (see Sprint 8/9 history), a table is never created without its own
 * proposal + explicit approval step. Implementing real queries against a
 * table that doesn't exist would not build.
 */
import { getSupabase } from '@/lib/supabase';
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

const NOT_IMPLEMENTED = 'PM Record Supabase repository is not implemented yet (no pm_records table exists).';

export class SupabasePmRecordRepository implements PmRecordRepository {
  /** Kept private and unused beyond construction until real queries are
   *  implemented - confirms this class is wired to the same client
   *  abstraction as the rest of the app, not a placeholder disconnected
   *  from it. */
  private readonly client = getSupabase();

  private readonly table = 'pm_records';

  async list(filter?: PmRecordFilter): Promise<PmRecord[]> {
    let query = this.client.from(this.table).select('*').order('created_at', { ascending: false });
    query = query.eq('record_status', 'Active');

    if (filter?.dealerId !== undefined && filter.dealerId !== null) {
      query = query.eq('dealer_id', filter.dealerId);
    }
    if (filter?.branchId !== undefined && filter.branchId !== null) {
      query = query.eq('branch_id', filter.branchId);
    }
    if (filter?.status !== undefined) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PmRecord[];
  }

  async getById(id: string): Promise<PmRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return data as PmRecord;
  }

  async create(input: PmRecordCreateInput, actor: { username: string }): Promise<PmRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = {
      id,
      dealer_id: input.dealer_id,
      branch_id: input.branch_id,
      serial: input.serial,
      technician_id: input.technician_id,
      scheduled_date: input.scheduled_date,
      status: input.status,
      notes: input.notes,
      created_by: actor.username,
      created_at: now,
      updated_by: actor.username,
      updated_at: now,
      record_status: 'Active',
    };

    const { data, error } = await this.client
      .from(this.table)
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as PmRecord;
  }

  async update(id: string, input: PmRecordUpdateInput, actor: { username: string }): Promise<PmRecord> {
    const updatePayload: Record<string, unknown> = {
      updated_by: actor.username,
      updated_at: new Date().toISOString(),
    };

    if (input.branch_id !== undefined) updatePayload.branch_id = input.branch_id;
    if (input.serial !== undefined) updatePayload.serial = input.serial;
    if (input.technician_id !== undefined) updatePayload.technician_id = input.technician_id;
    if (input.scheduled_date !== undefined) updatePayload.scheduled_date = input.scheduled_date;
    if (input.performed_date !== undefined) updatePayload.performed_date = input.performed_date;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.notes !== undefined) updatePayload.notes = input.notes;

    const { data, error } = await this.client
      .from(this.table)
      .update(updatePayload)
      .eq('id', id)
      .eq('record_status', 'Active')
      .select('*')
      .single();
    if (error) throw error;
    return data as PmRecord;
  }

  async delete(id: string, actor: { username: string }): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({
        record_status: 'Deleted',
        deleted_by: actor.username,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('record_status', 'Active');
    if (error) throw error;
  }
}

