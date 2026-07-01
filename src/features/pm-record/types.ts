/**
 * PM Record (Preventive Maintenance) — shared types.
 *
 * Phase 2 (search-first production workflow). Fields below reflect the
 * actual live schema: dealer/branch/serial/model/delivery_date/engine_number
 * are a point-in-time snapshot of the selected vehicle (Tractor Master),
 * captured at auto-fill time - never a live join back to `vehicles` - so a
 * PM Record stays accurate even if the vehicle's master data changes later.
 * customer_name/customer_phone are entered fresh every PM (never auto-filled
 * - see pm-record-form.tsx), consistent with "Customer remains Snapshot
 * Data" in AI_CONTEXT.md's locked architecture decisions.
 */

/**
 * Status is intentionally untyped (plain string) rather than a fixed union.
 * Defining a specific status workflow is a business-logic decision this
 * sprint is not authorized to make. Replace with a real union once a
 * requirements sprint defines the actual PM lifecycle.
 */
export type PmRecordStatus = string;

export interface PmRecord {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  serial: string | null;
  model: string | null;
  delivery_date: string | null;
  engine_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  technician_id: string | null;
  /** Snapshot of the technician/branch name at PM time (resolved
   *  server-side, never client-supplied) - mirrors the existing
   *  `records.technician_name`/`branch_name` pattern in `lib/db.ts`, so
   *  History search/export never needs a live join. */
  technician_name: string | null;
  branch_name: string | null;
  scheduled_date: string | null;
  performed_date: string | null;
  hour_meter: number | null;
  pm_interval_id: string | null;
  pm_number: string | null;
  /** Computed at create time from performed_date + the interval's
   *  interval_months (month-based intervals only - an hour-based interval
   *  can't be projected without live hour-meter tracking). Powers the
   *  History "Overdue"/"Upcoming PM" quick filters as a simple indexed
   *  date comparison instead of a runtime join. */
  next_pm_due: string | null;
  meter_photo_url: string | null;
  nameplate_photo_url: string | null;
  report_photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  google_maps_url: string | null;
  status: PmRecordStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Shape accepted when creating a PM Record via the search-first workflow.
 * Server assigns id/audit fields and generates pm_number (never client-set,
 * mirrors how QIR's job_id is server-generated in SupabasePmRecordRepository,
 * not accepted from the request body).
 */
export type PmRecordCreateInput = Pick<
  PmRecord,
  | 'dealer_id'
  | 'branch_id'
  | 'serial'
  | 'model'
  | 'delivery_date'
  | 'engine_number'
  | 'customer_name'
  | 'customer_phone'
  | 'technician_id'
  | 'hour_meter'
  | 'pm_interval_id'
  | 'meter_photo_url'
  | 'nameplate_photo_url'
  | 'report_photo_url'
  | 'notes'
> & {
  /** The date the PM was actually performed (today, by default - this
   *  workflow records a visit happening now, not a future appointment). */
  performed_date: string;
  /** GPS is optional (Phase 3) - omit entirely, or send null, if the
   *  technician didn't capture a location. */
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  google_maps_url?: string | null;
};

/** Shape accepted when updating a PM Record. All fields optional (partial patch). */
export type PmRecordUpdateInput = Partial<
  Pick<
    PmRecord,
    | 'branch_id'
    | 'serial'
    | 'technician_id'
    | 'scheduled_date'
    | 'performed_date'
    | 'status'
    | 'notes'
    | 'customer_name'
    | 'customer_phone'
    | 'hour_meter'
    | 'pm_interval_id'
    | 'meter_photo_url'
    | 'nameplate_photo_url'
    | 'report_photo_url'
    | 'latitude'
    | 'longitude'
    | 'gps_accuracy'
    | 'google_maps_url'
  >
>;

/** Params for the pre-save duplicate check: same tractor + same PM interval
 *  + same performed date already recorded (Active rows only). */
export interface PmDuplicateCheckParams {
  serial: string;
  pmIntervalId: string;
  performedDate: string;
}

export type PmHistorySortField = 'performed_date' | 'pm_number' | 'hour_meter' | 'created_at';
export type PmHistorySortDir = 'asc' | 'desc';

/** Server-side, paginated, filtered, searchable History query (Phase 4a).
 *  `search` is the universal search box (matches across PM number/serial/
 *  customer name/phone/technician/branch/model/notes); every other field
 *  is an Advanced Filter narrowing the same result set (AND semantics). */
export interface PmHistoryFilter {
  dealerId?: string | null;
  branchId?: string | null;
  /** Exact branch-name match, used for session-based branch scoping (a
   *  restricted user's own session.branch) - distinct from branchId, which
   *  is an explicit Advanced Filter selection by the branches table's id. */
  branchName?: string | null;
  technicianId?: string | null;
  pmIntervalId?: string | null;
  pmNumber?: string | null;
  serial?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  model?: string | null;
  hourMeterMin?: number | null;
  hourMeterMax?: number | null;
  createdBy?: string | null;
  status?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  overdue?: boolean;
  upcoming?: boolean;
  search?: string | null;
  page: number;
  pageSize: number;
  sortField?: PmHistorySortField;
  sortDir?: PmHistorySortDir;
}

export interface PmHistoryResult {
  data: PmRecord[];
  total: number;
}
