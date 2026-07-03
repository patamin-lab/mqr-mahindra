/**
 * NTR — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase`, same
 * pattern every other repository in this app uses - no second Supabase
 * client/connection. Table name `ntr_records` per the migration.
 */
import { getSupabase } from '@/lib/supabase';
import { NtrRepository } from './ntrRepository';
import { NtrHistoryFilter, NtrHistoryResult, NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';

/** General (non-powertrain) warranty window, same 24-month limit
 *  `calcWarranty()` (src/lib/warranty.ts) already applies to MQR claims -
 *  reused here so NTR's "Warranty Status" filter can never silently drift
 *  from MQR's warranty rule. `warrantyStatus` is a computed filter, not a
 *  stored column - "in warranty" means `retail_date` within the last 24
 *  months; a null `retail_date` folds into "out of warranty" for filtering
 *  purposes only (the record detail page still shows it distinctly, via
 *  `calcWarranty()`, as "delivery date not specified"). */
const GENERAL_WARRANTY_MONTHS = 24;

function warrantyCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - GENERAL_WARRANTY_MONTHS);
  return cutoff.toISOString().slice(0, 10);
}

export class SupabaseNtrRepository implements NtrRepository {
  private readonly client = getSupabase();

  private readonly table = 'ntr_records';

  async getById(id: string): Promise<NtrRecord | null> {
    const { data, error } = await this.client.from(this.table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return data as NtrRecord;
  }

  async findActiveBySerial(serial: string): Promise<NtrRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('record_status', 'Active')
      .eq('serial', serial)
      .maybeSingle();
    if (error) throw error;
    return (data as NtrRecord) ?? null;
  }

  /** Generates the business-facing NTR number NTR-[DealerCode]-[Year]-[Running]
   *  via the existing job_seq table / next_job_seq() RPC - the same
   *  generic (bucket_key, year) -> atomic increment counter MQR's job_id and
   *  PM's pm_number already use, keyed by a module-prefixed bucket
   *  (`NTR:<dealerId>`) so NTR's counter can never collide with MQR's or
   *  PM's for the same dealer/year. */
  private async nextNtrNumber(dealerId: string): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await this.client.rpc('next_job_seq', {
      p_dealer_id: `NTR:${dealerId}`,
      p_year: year,
    });
    if (error) throw error;
    const seq = Number(data);
    return `NTR-${dealerId}-${year}-${String(seq).padStart(6, '0')}`;
  }

  async create(input: NtrRecordCreateInput, actor: { username: string }): Promise<NtrRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const ntrNumber = await this.nextNtrNumber(input.dealer_id);

    const payload = {
      id,
      ntr_number: ntrNumber,
      dealer_id: input.dealer_id,
      branch_id: input.branch_id,
      serial: input.serial,
      model: input.model,
      engine_number: input.engine_number,
      salesperson: input.salesperson,
      receiving_person: input.receiving_person,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_address: input.customer_address,
      customer_district: input.customer_district,
      customer_province: input.customer_province,
      customer_postal_code: input.customer_postal_code,
      customer_type: input.customer_type,
      retail_date: input.retail_date,
      delivery_date: input.delivery_date,
      hour_meter: input.hour_meter,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      gps_accuracy: input.gps_accuracy ?? null,
      google_maps_url: input.google_maps_url ?? null,
      photo_customer_tractor_url: input.photo_customer_tractor_url,
      photo_serial_plate_url: input.photo_serial_plate_url,
      photo_hour_meter_url: input.photo_hour_meter_url,
      photo_signed_document_url: input.photo_signed_document_url,
      additional_photos: input.additional_photos ?? [],
      video_url: input.video_url,
      audio_url: input.audio_url,
      status: 'Completed',
      record_status: 'Active',
      source: input.source ?? 'manual',
      import_session_id: input.import_session_id ?? null,
      created_by: actor.username,
      created_at: now,
      updated_by: actor.username,
      updated_at: now,
    };

    const { data, error } = await this.client.from(this.table).insert(payload).select('*').single();
    if (error) throw error;
    return data as NtrRecord;
  }

  async update(id: string, input: NtrRecordUpdateInput, actor: { username: string }): Promise<NtrRecord> {
    const updatePayload: Record<string, unknown> = {
      updated_by: actor.username,
      updated_at: new Date().toISOString(),
    };

    if (input.branch_id !== undefined) updatePayload.branch_id = input.branch_id;
    if (input.salesperson !== undefined) updatePayload.salesperson = input.salesperson;
    if (input.receiving_person !== undefined) updatePayload.receiving_person = input.receiving_person;
    if (input.customer_name !== undefined) updatePayload.customer_name = input.customer_name;
    if (input.customer_phone !== undefined) updatePayload.customer_phone = input.customer_phone;
    if (input.customer_address !== undefined) updatePayload.customer_address = input.customer_address;
    if (input.customer_district !== undefined) updatePayload.customer_district = input.customer_district;
    if (input.customer_province !== undefined) updatePayload.customer_province = input.customer_province;
    if (input.customer_postal_code !== undefined) updatePayload.customer_postal_code = input.customer_postal_code;
    if (input.customer_type !== undefined) updatePayload.customer_type = input.customer_type;
    if (input.retail_date !== undefined) updatePayload.retail_date = input.retail_date;
    if (input.delivery_date !== undefined) updatePayload.delivery_date = input.delivery_date;
    if (input.hour_meter !== undefined) updatePayload.hour_meter = input.hour_meter;
    if (input.latitude !== undefined) updatePayload.latitude = input.latitude;
    if (input.longitude !== undefined) updatePayload.longitude = input.longitude;
    if (input.gps_accuracy !== undefined) updatePayload.gps_accuracy = input.gps_accuracy;
    if (input.google_maps_url !== undefined) updatePayload.google_maps_url = input.google_maps_url;
    if (input.photo_customer_tractor_url !== undefined) updatePayload.photo_customer_tractor_url = input.photo_customer_tractor_url;
    if (input.photo_serial_plate_url !== undefined) updatePayload.photo_serial_plate_url = input.photo_serial_plate_url;
    if (input.photo_hour_meter_url !== undefined) updatePayload.photo_hour_meter_url = input.photo_hour_meter_url;
    if (input.photo_signed_document_url !== undefined) updatePayload.photo_signed_document_url = input.photo_signed_document_url;
    if (input.additional_photos !== undefined) updatePayload.additional_photos = input.additional_photos;
    if (input.video_url !== undefined) updatePayload.video_url = input.video_url;
    if (input.audio_url !== undefined) updatePayload.audio_url = input.audio_url;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await this.client
      .from(this.table)
      .update(updatePayload)
      .eq('id', id)
      .eq('record_status', 'Active')
      .select('*')
      .single();
    if (error) throw error;
    return data as NtrRecord;
  }

  async delete(id: string, actor: { username: string }, reason?: string | null): Promise<void> {
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
    // `reason` is accepted for interface parity with MaintenanceRepository
    // (a future admin-forced-delete flow may want it) but NTR has no
    // deleted_reason column yet - unused today, not silently dropped data.
    void reason;
  }

  async listHistory(filter: NtrHistoryFilter): Promise<NtrHistoryResult> {
    const page = Math.max(filter.page, 1);
    const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client.from(this.table).select('*', { count: 'exact' }).eq('record_status', 'Active');

    if (filter.dealerId) query = query.eq('dealer_id', filter.dealerId);
    if (filter.branchId) query = query.eq('branch_id', filter.branchId);
    if (filter.model?.trim()) query = query.ilike('model', `%${filter.model.trim()}%`);
    if (filter.province?.trim()) query = query.ilike('customer_province', `%${filter.province.trim()}%`);
    if (filter.district?.trim()) query = query.ilike('customer_district', `%${filter.district.trim()}%`);
    if (filter.retailDateFrom) query = query.gte('retail_date', filter.retailDateFrom);
    if (filter.retailDateTo) query = query.lte('retail_date', filter.retailDateTo);
    if (filter.customerName?.trim()) query = query.ilike('customer_name', `%${filter.customerName.trim()}%`);
    if (filter.serial?.trim()) query = query.ilike('serial', `%${filter.serial.trim()}%`);
    if (filter.status?.trim()) query = query.eq('status', filter.status.trim());
    if (filter.warrantyStatus === 'in_warranty') {
      query = query.not('retail_date', 'is', null).gte('retail_date', warrantyCutoffIso());
    } else if (filter.warrantyStatus === 'out_of_warranty') {
      query = query.or(`retail_date.is.null,retail_date.lt.${warrantyCutoffIso()}`);
    }
    if (filter.search?.trim()) {
      const term = filter.search.trim();
      query = query.or(
        `ntr_number.ilike.%${term}%,serial.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,model.ilike.%${term}%`
      );
    }

    const sortField = filter.sortField ?? 'created_at';
    const sortDir = filter.sortDir ?? 'desc';
    query = query.order(sortField, { ascending: sortDir === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as NtrRecord[], total: count ?? 0 };
  }
}
