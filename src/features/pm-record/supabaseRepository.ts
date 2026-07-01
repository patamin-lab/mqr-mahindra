/**
 * PM Record — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase` (same
 * pattern every other table in `src/lib/db.ts` uses) rather than creating
 * a second Supabase client/connection.
 */
import { getSupabase } from '@/lib/supabase';
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmDuplicateCheckParams, PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

export class SupabasePmRecordRepository implements PmRecordRepository {
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

  /** Generates the business-facing PM number PM-[DealerCode]-[Year]-[Running],
   *  reusing the existing job_seq table / next_job_seq() RPC that QIR's job_id
   *  already uses - it's already a generic (dealer_id, year) -> atomic
   *  increment counter; QIR just calls it with a global sentinel dealer_id,
   *  while PM Record calls it with the real dealer code so each dealer gets
   *  its own running sequence that resets every year, per spec. */
  private async nextPmNumber(dealerId: string): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await this.client.rpc('next_job_seq', {
      p_dealer_id: dealerId,
      p_year: year,
    });
    if (error) throw error;
    const seq = Number(data);
    return `PM-${dealerId}-${year}-${String(seq).padStart(6, '0')}`;
  }

  async create(input: PmRecordCreateInput, actor: { username: string }): Promise<PmRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const pmNumber = await this.nextPmNumber(input.dealer_id);
    const payload = {
      id,
      dealer_id: input.dealer_id,
      branch_id: input.branch_id,
      serial: input.serial,
      model: input.model,
      delivery_date: input.delivery_date,
      engine_number: input.engine_number,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      technician_id: input.technician_id,
      performed_date: input.performed_date,
      hour_meter: input.hour_meter,
      pm_interval_id: input.pm_interval_id,
      pm_number: pmNumber,
      meter_photo_url: input.meter_photo_url,
      nameplate_photo_url: input.nameplate_photo_url,
      report_photo_url: input.report_photo_url,
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
    if (input.customer_name !== undefined) updatePayload.customer_name = input.customer_name;
    if (input.customer_phone !== undefined) updatePayload.customer_phone = input.customer_phone;
    if (input.hour_meter !== undefined) updatePayload.hour_meter = input.hour_meter;
    if (input.pm_interval_id !== undefined) updatePayload.pm_interval_id = input.pm_interval_id;
    if (input.meter_photo_url !== undefined) updatePayload.meter_photo_url = input.meter_photo_url;
    if (input.nameplate_photo_url !== undefined) updatePayload.nameplate_photo_url = input.nameplate_photo_url;
    if (input.report_photo_url !== undefined) updatePayload.report_photo_url = input.report_photo_url;

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

  async findDuplicate(params: PmDuplicateCheckParams): Promise<PmRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('record_status', 'Active')
      .eq('serial', params.serial)
      .eq('pm_interval_id', params.pmIntervalId)
      .eq('performed_date', params.performedDate)
      .maybeSingle();
    if (error) throw error;
    return (data as PmRecord) ?? null;
  }
}
