/**
 * PM Record — Supabase-backed repository implementation.
 *
 * Sprint 11.2: Implements create() and getById() against the pm_records table
 * created in this sprint. All other stubs remain for future sprints.
 *
 * Uses the shared server-only client from @/lib/supabase (same pattern as
 * every other table in src/lib/db.ts). No business logic here — that lives
 * in the service layer (PmRecordService).
 */
import { getSupabase } from '@/lib/supabase';
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

export class SupabasePmRecordRepository implements PmRecordRepository {
  /** Shared server-only Supabase client. */
  private readonly client = getSupabase();

  async list(filter?: PmRecordFilter): Promise<PmRecord[]> {
    let q = this.client
      .from('pm_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.dealerId) q = q.eq('dealer_id', filter.dealerId);
    if (filter?.branchId) q = q.eq('branch_id', filter.branchId);
    if (filter?.status) q = q.eq('status', filter.status);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as PmRecord[];
  }

  async getById(id: string): Promise<PmRecord | null> {
    const { data, error } = await this.client
      .from('pm_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as PmRecord | null;
  }

  async create(
    input: PmRecordCreateInput,
    actor: { username: string },
  ): Promise<PmRecord> {
    const { data, error } = await this.client
      .from('pm_records')
      .insert({
        dealer_id: input.dealer_id,
        branch_id: input.branch_id ?? null,
        serial: input.serial ?? null,
        model: input.model ?? null,
        delivery_date: input.delivery_date ?? null,
        customer_name: input.customer_name ?? null,
        customer_phone: input.customer_phone ?? null,
        scheduled_date: input.scheduled_date,
        status: input.status,
        notes: input.notes ?? null,
        created_by: actor.username,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as PmRecord;
  }

  async update(
    id: string,
    input: PmRecordUpdateInput,
    actor: { username: string },
  ): Promise<PmRecord> {
    const { data, error } = await this.client
      .from('pm_records')
      .update({
        ...input,
        updated_by: actor.username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PmRecord;
  }

  async delete(id: string, _actor: { username: string }): Promise<void> {
    const { error } = await this.client.from('pm_records').delete().eq('id', id);
    if (error) throw error;
  }
}
