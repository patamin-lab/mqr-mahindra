/**
 * NTR — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase`, same
 * pattern every other repository in this app uses - no second Supabase
 * client/connection. Table name `ntr_records` per the migration.
 */
import { getSupabase } from '@/lib/supabase';
import { applyScope } from '@/lib/db';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import type { SessionUser } from '@/lib/types';
import { MasterDataService } from '@/shared/master-data';
import { NtrLegacyImportVehicleInput, NtrRepository } from './ntrRepository';
import { NtrHistoryFilter, NtrHistoryResult, NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';

/** "In warranty" means `retail_date` within the general (non-powertrain)
 *  warranty window - read from the Configuration Platform
 *  (`MasterDataService.getWarrantyLimitMonths()`) rather than a locally
 *  duplicated 24, so NTR's "Warranty Status" filter can never silently
 *  drift from MQR's warranty rule (`lib/warranty.ts`'s `calcWarranty()`,
 *  which reads the same two numbers independently since `lib/`
 *  Infrastructure may not depend on this Platform service - see that
 *  file's own doc comment). `warrantyStatus` is a computed filter, not a
 *  stored column; a null `retail_date` folds into "out of warranty" for
 *  filtering purposes only (the record detail page still shows it
 *  distinctly, via `calcWarranty()`, as "delivery date not specified"). */
function warrantyCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MasterDataService.getWarrantyLimitMonths('other'));
  return cutoff.toISOString().slice(0, 10);
}

export class SupabaseNtrRepository implements NtrRepository {
  private readonly client = getSupabase();

  private readonly table = 'ntr_records';

  /** `session` is optional for interface back-compat with existing callers
   *  during the Dealer/Branch Scope Platform Standard rollout (see
   *  PROJECT_STATE.md/the DealerBranchScope plan) - once NTR's API routes
   *  are migrated (Phase "NTR"), every caller should pass it so a
   *  DealerUser can never fetch a record outside their own branch. */
  async getById(id: string, session?: SessionUser): Promise<NtrRecord | null> {
    const { data, error } = await this.client.from(this.table).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    if (session && !canAccessDealerBranch(session, data.dealer_id, data.branch_id ?? null)) return null;
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

  /** Chunked - `.in('serial', [...])` with thousands of distinct serials
   *  in one request builds a URL long enough to hit "414 Request-URI Too
   *  Large" in front of Supabase (confirmed via a live 10,000-row Legacy
   *  Import UAT run). A small, fixed number of parallel chunked requests
   *  instead of one per row (the defect this method was added to fix)
   *  or one unbounded request (the regression this chunking then fixed). */
  async findActiveBySerials(serials: string[]): Promise<Map<string, NtrRecord>> {
    if (serials.length === 0) return new Map();
    const chunkSize = 200;
    const batches: string[][] = [];
    for (let i = 0; i < serials.length; i += chunkSize) batches.push(serials.slice(i, i + chunkSize));
    const results = await Promise.all(
      batches.map(async (batch) => {
        const { data, error } = await this.client.from(this.table).select('*').eq('record_status', 'Active').in('serial', batch);
        if (error) throw error;
        return data as NtrRecord[];
      })
    );
    return new Map(results.flat().map((r) => [r.serial, r]));
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
      customer_title: input.customer_title,
      customer_first_name: input.customer_first_name,
      customer_last_name: input.customer_last_name,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_address: input.customer_address,
      customer_subdistrict: input.customer_subdistrict,
      customer_district: input.customer_district,
      customer_province: input.customer_province,
      customer_postal_code: input.customer_postal_code,
      customer_type: input.customer_type,
      product_family_id: input.product_family_id,
      variant: input.variant,
      retail_date: input.retail_date,
      delivery_date: input.delivery_date,
      pdi_date: input.pdi_date,
      pdi_number: input.pdi_number,
      manufacturing_year: input.manufacturing_year,
      hour_meter: input.hour_meter,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      gps_accuracy: input.gps_accuracy ?? null,
      google_maps_url: input.google_maps_url ?? null,
      photo_customer_id_url: input.photo_customer_id_url,
      photo_customer_tractor_url: input.photo_customer_tractor_url,
      photo_serial_plate_url: input.photo_serial_plate_url,
      photo_hour_meter_url: input.photo_hour_meter_url,
      photo_signed_document_url: input.photo_signed_document_url,
      photo_customer_id_attachment_id: input.photo_customer_id_attachment_id ?? null,
      photo_customer_tractor_attachment_id: input.photo_customer_tractor_attachment_id ?? null,
      photo_serial_plate_attachment_id: input.photo_serial_plate_attachment_id ?? null,
      photo_hour_meter_attachment_id: input.photo_hour_meter_attachment_id ?? null,
      photo_signed_document_attachment_id: input.photo_signed_document_attachment_id ?? null,
      additional_photos: input.additional_photos ?? [],
      video_url: input.video_url,
      video_attachment_id: input.video_attachment_id ?? null,
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
    if (input.customer_title !== undefined) updatePayload.customer_title = input.customer_title;
    if (input.customer_first_name !== undefined) updatePayload.customer_first_name = input.customer_first_name;
    if (input.customer_last_name !== undefined) updatePayload.customer_last_name = input.customer_last_name;
    if (input.customer_name !== undefined) updatePayload.customer_name = input.customer_name;
    if (input.customer_phone !== undefined) updatePayload.customer_phone = input.customer_phone;
    if (input.customer_address !== undefined) updatePayload.customer_address = input.customer_address;
    if (input.customer_subdistrict !== undefined) updatePayload.customer_subdistrict = input.customer_subdistrict;
    if (input.customer_district !== undefined) updatePayload.customer_district = input.customer_district;
    if (input.customer_province !== undefined) updatePayload.customer_province = input.customer_province;
    if (input.customer_postal_code !== undefined) updatePayload.customer_postal_code = input.customer_postal_code;
    if (input.customer_type !== undefined) updatePayload.customer_type = input.customer_type;
    if (input.product_family_id !== undefined) updatePayload.product_family_id = input.product_family_id;
    if (input.variant !== undefined) updatePayload.variant = input.variant;
    if (input.pdi_date !== undefined) updatePayload.pdi_date = input.pdi_date;
    if (input.pdi_number !== undefined) updatePayload.pdi_number = input.pdi_number;
    if (input.manufacturing_year !== undefined) updatePayload.manufacturing_year = input.manufacturing_year;
    if (input.retail_date !== undefined) updatePayload.retail_date = input.retail_date;
    if (input.delivery_date !== undefined) updatePayload.delivery_date = input.delivery_date;
    if (input.hour_meter !== undefined) updatePayload.hour_meter = input.hour_meter;
    if (input.latitude !== undefined) updatePayload.latitude = input.latitude;
    if (input.longitude !== undefined) updatePayload.longitude = input.longitude;
    if (input.gps_accuracy !== undefined) updatePayload.gps_accuracy = input.gps_accuracy;
    if (input.google_maps_url !== undefined) updatePayload.google_maps_url = input.google_maps_url;
    if (input.photo_customer_id_url !== undefined) updatePayload.photo_customer_id_url = input.photo_customer_id_url;
    if (input.photo_customer_tractor_url !== undefined) updatePayload.photo_customer_tractor_url = input.photo_customer_tractor_url;
    if (input.photo_serial_plate_url !== undefined) updatePayload.photo_serial_plate_url = input.photo_serial_plate_url;
    if (input.photo_hour_meter_url !== undefined) updatePayload.photo_hour_meter_url = input.photo_hour_meter_url;
    if (input.photo_signed_document_url !== undefined) updatePayload.photo_signed_document_url = input.photo_signed_document_url;
    if (input.photo_customer_id_attachment_id !== undefined) updatePayload.photo_customer_id_attachment_id = input.photo_customer_id_attachment_id;
    if (input.photo_customer_tractor_attachment_id !== undefined) updatePayload.photo_customer_tractor_attachment_id = input.photo_customer_tractor_attachment_id;
    if (input.photo_serial_plate_attachment_id !== undefined) updatePayload.photo_serial_plate_attachment_id = input.photo_serial_plate_attachment_id;
    if (input.photo_hour_meter_attachment_id !== undefined) updatePayload.photo_hour_meter_attachment_id = input.photo_hour_meter_attachment_id;
    if (input.photo_signed_document_attachment_id !== undefined) updatePayload.photo_signed_document_attachment_id = input.photo_signed_document_attachment_id;
    if (input.additional_photos !== undefined) updatePayload.additional_photos = input.additional_photos;
    if (input.video_url !== undefined) updatePayload.video_url = input.video_url;
    if (input.video_attachment_id !== undefined) updatePayload.video_attachment_id = input.video_attachment_id;
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

  /** Calls `soft_delete_ntr_record()` (SECURITY DEFINER RPC) instead of a
   *  direct `.update()` - a confirmed, unexplained Postgres/Supabase-level
   *  anomaly rejects the `anon` role's UPDATE transitioning
   *  `record_status` away from 'Active' on this table, even under a
   *  fully-permissive RLS policy (reproduced in a minimal SQL case with
   *  no application logic; every other mechanism - triggers, rules,
   *  inheritance, views, generated columns, grants, hidden policies -
   *  ruled out). This is a narrow, single-purpose bypass for exactly this
   *  write, not a replacement for RLS: every authorization check (role,
   *  ownership, scope, `canDelete()`) still happens in application code
   *  before this is ever called - see `NtrService.delete()` and
   *  `src/app/api/ntr-records/[id]/route.ts`'s `DELETE` handler. If
   *  Supabase later identifies the platform-level root cause, this can
   *  revert to a plain `.update()` - the call site's contract (this
   *  method's signature) does not change either way. */
  async delete(id: string, actor: { username: string }, reason?: string | null): Promise<void> {
    // `reason` is accepted for interface parity with MaintenanceRepository
    // (a future admin-forced-delete flow may want it) but NTR has no
    // deleted_reason column yet - unused today, not silently dropped data.
    const { error } = await this.client.rpc('soft_delete_ntr_record', {
      p_id: id,
      p_actor: actor.username,
      p_reason: reason ?? null,
    });
    if (error) {
      if (error.message.includes('NTR_NOT_FOUND')) throw new Error('NTR record not found');
      if (error.message.includes('NTR_ALREADY_DELETED')) throw new Error('NTR record is already deleted');
      throw error;
    }
  }

  /** `session`, when passed, resolves dealer/branch scope via the shared
   *  `applyScope()` (Dealer/Branch Scope Platform Standard) instead of
   *  trusting `filter.dealerId`/`filter.branchId` as-is - optional only for
   *  back-compat with callers not yet migrated (NTR API routes/UI, Phase
   *  "NTR" of the rollout). */
  async listHistory(filter: NtrHistoryFilter, session?: SessionUser): Promise<NtrHistoryResult> {
    const page = Math.max(filter.page, 1);
    const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client.from(this.table).select('*', { count: 'exact' }).eq('record_status', 'Active');

    if (session) {
      query = applyScope(query, session, { dealerId: filter.dealerId, branchId: filter.branchId });
      // applyScope() re-applies record_status='Active' (harmless, idempotent)
      // and dealer_id/branch_id — remove the raw pass-through below for this path.
    } else {
      if (filter.dealerId) query = query.eq('dealer_id', filter.dealerId);
      if (filter.branchId) query = query.eq('branch_id', filter.branchId);
    }
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

  /** Distinct, non-blank `variant` values already recorded for a Product
   *  Family - reuses data already on `ntr_records` rather than a new Sub
   *  Model master-data table (see `NtrRepository`'s doc comment). Sorted
   *  for a stable dropdown order; a brand-new Product Family with no
   *  prior registrations simply has no options yet. */
  async listDistinctVariants(productFamilyId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('variant')
      .eq('product_family_id', productFamilyId)
      .eq('record_status', 'Active')
      .not('variant', 'is', null);
    if (error) throw error;
    const values = new Set<string>();
    for (const row of (data ?? []) as { variant: string | null }[]) {
      if (row.variant?.trim()) values.add(row.variant.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  /** Calls the `commit_ntr_legacy_import_row` Postgres function - one RPC
   *  call is one Postgres transaction, so Tractor + NTR + Timeline + Audit
   *  either all land together or none do (a raised exception, e.g. the
   *  function's own duplicate-serial race check, rolls back everything
   *  the call did). See docs/adr/ADR-008-Google-Drive-Decoupling.md. */
  async commitLegacyImportRow(
    sessionId: string,
    vehicle: NtrLegacyImportVehicleInput,
    ntr: NtrRecordCreateInput,
    actor: { username: string }
  ): Promise<NtrRecord> {
    const { data, error } = await this.client.rpc('commit_ntr_legacy_import_row', {
      p_session_id: sessionId,
      p_vehicle: {
        model: vehicle.model,
        engine_number: vehicle.engineNumber,
        branch_id: vehicle.branchId,
        delivery_date: vehicle.deliveryDate,
      },
      p_ntr: {
        dealer_id: ntr.dealer_id,
        branch_id: ntr.branch_id,
        serial: ntr.serial,
        model: ntr.model,
        engine_number: ntr.engine_number,
        salesperson: ntr.salesperson,
        receiving_person: ntr.receiving_person,
        customer_title: ntr.customer_title,
        customer_first_name: ntr.customer_first_name,
        customer_last_name: ntr.customer_last_name,
        customer_name: ntr.customer_name,
        customer_phone: ntr.customer_phone,
        customer_address: ntr.customer_address,
        customer_subdistrict: ntr.customer_subdistrict,
        customer_district: ntr.customer_district,
        customer_province: ntr.customer_province,
        customer_postal_code: ntr.customer_postal_code,
        customer_type: ntr.customer_type,
        product_family_id: ntr.product_family_id,
        variant: ntr.variant,
        retail_date: ntr.retail_date,
        delivery_date: ntr.delivery_date,
        pdi_date: ntr.pdi_date,
        pdi_number: ntr.pdi_number,
        manufacturing_year: ntr.manufacturing_year,
        hour_meter: ntr.hour_meter,
      },
      p_actor: actor.username,
    });
    if (error) throw error;
    return data as NtrRecord;
  }
}
