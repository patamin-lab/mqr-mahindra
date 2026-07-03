/**
 * Maintenance — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase` (same
 * pattern every other table in `src/lib/db.ts` uses) rather than creating
 * a second Supabase client/connection. Table name (`pm_records`) is
 * unchanged - Architecture Refactoring's backward-compatibility rule.
 */
import { getSupabase } from '@/lib/supabase';
import { MaintenanceRepository, MaintenanceFilter } from './maintenanceRepository';
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
  MaintenanceLockReason,
  MaintenanceRecord,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
} from '../types';

/** Universal-search columns (Phase 4a) - all GIN-trigram-indexed, see the
 *  align_pm_records_history_search_support migration. */
const HISTORY_SEARCH_COLUMNS = [
  'pm_number',
  'serial',
  'dealer_id',
  'customer_name',
  'customer_phone',
  'technician_name',
  'branch_name',
  'model',
  'notes',
] as const;

export class SupabaseMaintenanceRepository implements MaintenanceRepository {
  private readonly client = getSupabase();

  private readonly table = 'pm_records';

  async list(filter?: MaintenanceFilter): Promise<MaintenanceRecord[]> {
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
    return (data ?? []) as MaintenanceRecord[];
  }

  async getById(id: string): Promise<MaintenanceRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return data as MaintenanceRecord;
  }

  /** Generates the business-facing PM number PM-[DealerCode]-[Year]-[Running],
   *  reusing the existing job_seq table / next_job_seq() RPC that QIR's job_id
   *  already uses - it's already a generic (dealer_id, year) -> atomic
   *  increment counter; QIR just calls it with a global sentinel dealer_id,
   *  while Maintenance calls it with the real dealer code so each dealer
   *  gets its own running sequence that resets every year, per spec. */
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

  /** Resolves the technician/branch name snapshot and the projected
   *  next_pm_due date server-side (never trusts client-supplied names -
   *  same "zero-leakage" principle already applied to dealer_id). Runs in
   *  parallel with pm_number generation since none depend on each other. */
  private async resolveSnapshotFields(input: MaintenanceRecordCreateInput): Promise<{
    technicianName: string | null;
    branchName: string | null;
    nextPmDue: string | null;
  }> {
    const [technicianRow, branchRow, intervalRow] = await Promise.all([
      input.technician_id
        ? this.client.from('technicians').select('name').eq('id', input.technician_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      input.branch_id
        ? this.client.from('branches').select('name').eq('id', input.branch_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      input.pm_interval_id
        ? this.client.from('pm_intervals').select('interval_months').eq('id', input.pm_interval_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (technicianRow.error) throw technicianRow.error;
    if (branchRow.error) throw branchRow.error;
    if (intervalRow.error) throw intervalRow.error;

    let nextPmDue: string | null = null;
    const intervalMonths = (intervalRow.data as { interval_months: number | null } | null)?.interval_months;
    if (intervalMonths) {
      const due = new Date(input.performed_date);
      due.setMonth(due.getMonth() + intervalMonths);
      nextPmDue = due.toISOString().slice(0, 10);
    }

    return {
      technicianName: (technicianRow.data as { name: string } | null)?.name ?? null,
      branchName: (branchRow.data as { name: string } | null)?.name ?? null,
      nextPmDue,
    };
  }

  async create(input: MaintenanceRecordCreateInput, actor: { username: string }): Promise<MaintenanceRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const [pmNumber, snapshot] = await Promise.all([
      this.nextPmNumber(input.dealer_id),
      this.resolveSnapshotFields(input),
    ]);
    const payload = {
      id,
      dealer_id: input.dealer_id,
      branch_id: input.branch_id,
      branch_name: snapshot.branchName,
      serial: input.serial,
      model: input.model,
      delivery_date: input.delivery_date,
      engine_number: input.engine_number,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      technician_id: input.technician_id,
      technician_name: snapshot.technicianName,
      performed_date: input.performed_date,
      hour_meter: input.hour_meter,
      pm_interval_id: input.pm_interval_id,
      next_pm_due: snapshot.nextPmDue,
      pm_number: pmNumber,
      meter_photo_url: input.meter_photo_url,
      nameplate_photo_url: input.nameplate_photo_url,
      report_photo_url: input.report_photo_url,
      meter_photo_attachment_id: input.meter_photo_attachment_id ?? null,
      nameplate_photo_attachment_id: input.nameplate_photo_attachment_id ?? null,
      report_photo_attachment_id: input.report_photo_attachment_id ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      gps_accuracy: input.gps_accuracy,
      google_maps_url: input.google_maps_url,
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
    return data as MaintenanceRecord;
  }

  async update(id: string, input: MaintenanceRecordUpdateInput, actor: { username: string }): Promise<MaintenanceRecord> {
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
    if (input.meter_photo_attachment_id !== undefined) updatePayload.meter_photo_attachment_id = input.meter_photo_attachment_id;
    if (input.nameplate_photo_attachment_id !== undefined) updatePayload.nameplate_photo_attachment_id = input.nameplate_photo_attachment_id;
    if (input.report_photo_attachment_id !== undefined) updatePayload.report_photo_attachment_id = input.report_photo_attachment_id;
    if (input.latitude !== undefined) updatePayload.latitude = input.latitude;
    if (input.longitude !== undefined) updatePayload.longitude = input.longitude;
    if (input.gps_accuracy !== undefined) updatePayload.gps_accuracy = input.gps_accuracy;
    if (input.google_maps_url !== undefined) updatePayload.google_maps_url = input.google_maps_url;

    const { data, error } = await this.client
      .from(this.table)
      .update(updatePayload)
      .eq('id', id)
      .eq('record_status', 'Active')
      .select('*')
      .single();
    if (error) throw error;
    return data as MaintenanceRecord;
  }

  async delete(id: string, actor: { username: string }, reason?: string | null): Promise<void> {
    const { error } = await this.client
      .from(this.table)
      .update({
        record_status: 'Deleted',
        deleted_by: actor.username,
        deleted_at: new Date().toISOString(),
        deleted_reason: reason ?? null,
      })
      .eq('id', id)
      .eq('record_status', 'Active');
    if (error) throw error;
  }

  async lockRecord(id: string, reason: MaintenanceLockReason, actor: { username: string }): Promise<MaintenanceRecord> {
    const { data, error } = await this.client
      .from(this.table)
      .update({
        locked_at: new Date().toISOString(),
        locked_reason: reason,
        updated_by: actor.username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as MaintenanceRecord;
  }

  async unlockRecord(id: string, until: string, actor: { username: string }): Promise<MaintenanceRecord> {
    const { data, error } = await this.client
      .from(this.table)
      .update({
        unlocked_until: until,
        unlocked_by: actor.username,
        updated_by: actor.username,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as MaintenanceRecord;
  }

  async lockSupersededRecordsForVehicle(serial: string, actor: { username: string }): Promise<string[]> {
    const { data, error } = await this.client
      .from(this.table)
      .select('id, performed_date, created_at, locked_at')
      .eq('record_status', 'Active')
      .eq('serial', serial)
      .order('performed_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as { id: string; performed_date: string | null; created_at: string; locked_at: string | null }[];
    // The first row (already sorted newest-first) is the current "latest"
    // for this vehicle and is never locked by supersession - every other
    // active row that isn't already locked becomes locked now.
    const idsToLock = rows.slice(1).filter((r) => !r.locked_at).map((r) => r.id);
    if (idsToLock.length === 0) return [];

    const { error: updateError } = await this.client
      .from(this.table)
      .update({
        locked_at: new Date().toISOString(),
        locked_reason: 'superseded',
        updated_by: actor.username,
        updated_at: new Date().toISOString(),
      })
      .in('id', idsToLock);
    if (updateError) throw updateError;

    return idsToLock;
  }

  async findDuplicate(params: MaintenanceDuplicateCheckParams): Promise<MaintenanceRecord | null> {
    const { data, error } = await this.client
      .from(this.table)
      .select('*')
      .eq('record_status', 'Active')
      .eq('serial', params.serial)
      .eq('pm_interval_id', params.pmIntervalId)
      .eq('performed_date', params.performedDate)
      .maybeSingle();
    if (error) throw error;
    return (data as MaintenanceRecord) ?? null;
  }

  async listHistory(filter: MaintenanceHistoryFilter): Promise<MaintenanceHistoryResult> {
    const page = Math.max(filter.page, 1);
    const pageSize = Math.min(Math.max(filter.pageSize, 1), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from(this.table)
      .select('*', { count: 'exact' })
      .eq('record_status', 'Active');

    if (filter.dealerId) query = query.eq('dealer_id', filter.dealerId);
    if (filter.branchId) query = query.eq('branch_id', filter.branchId);
    if (filter.branchName) query = query.eq('branch_name', filter.branchName);
    if (filter.technicianId) query = query.eq('technician_id', filter.technicianId);
    if (filter.pmIntervalId) query = query.eq('pm_interval_id', filter.pmIntervalId);
    if (filter.pmNumber?.trim()) query = query.ilike('pm_number', `%${filter.pmNumber.trim()}%`);
    if (filter.serial?.trim()) query = query.ilike('serial', `%${filter.serial.trim()}%`);
    if (filter.customerName?.trim()) query = query.ilike('customer_name', `%${filter.customerName.trim()}%`);
    if (filter.customerPhone?.trim()) query = query.ilike('customer_phone', `%${filter.customerPhone.trim()}%`);
    if (filter.model?.trim()) query = query.ilike('model', `%${filter.model.trim()}%`);
    if (filter.createdBy?.trim()) query = query.eq('created_by', filter.createdBy.trim());
    if (filter.status?.trim()) query = query.eq('status', filter.status.trim());
    if (filter.hourMeterMin != null) query = query.gte('hour_meter', filter.hourMeterMin);
    if (filter.hourMeterMax != null) query = query.lte('hour_meter', filter.hourMeterMax);
    if (filter.dateFrom) query = query.gte('performed_date', filter.dateFrom);
    if (filter.dateTo) query = query.lte('performed_date', filter.dateTo);
    if (filter.overdue) {
      query = query.lt('next_pm_due', new Date().toISOString().slice(0, 10));
    }
    if (filter.upcoming) {
      const today = new Date();
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);
      query = query
        .gte('next_pm_due', today.toISOString().slice(0, 10))
        .lte('next_pm_due', in30Days.toISOString().slice(0, 10));
    }
    if (filter.search?.trim()) {
      const term = filter.search.trim();
      query = query.or(HISTORY_SEARCH_COLUMNS.map((col) => `${col}.ilike.%${term}%`).join(','));
    }

    const sortField = filter.sortField ?? 'performed_date';
    const sortDir = filter.sortDir ?? 'desc';
    query = query.order(sortField, { ascending: sortDir === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as MaintenanceRecord[], total: count ?? 0 };
  }
}
