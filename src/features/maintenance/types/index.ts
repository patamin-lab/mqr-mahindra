/**
 * Maintenance (Preventive Maintenance / "PM" to users) — shared types.
 *
 * Architecture Refactoring: the technical domain is named `maintenance`;
 * business/user-facing wording (PM Record, PM History, PM Report, PM
 * Interval) is unchanged - see root README/AI_CONTEXT.md. Database table
 * (`pm_records`) and API route (`/api/pm-records`) are also unchanged, per
 * the refactor's explicit backward-compatibility rule.
 *
 * Phase 2 (search-first production workflow). Fields below reflect the
 * actual live schema: dealer/branch/serial/model/delivery_date/engine_number
 * are a point-in-time snapshot of the selected vehicle (Tractor Master),
 * captured at auto-fill time - never a live join back to `vehicles` - so a
 * record stays accurate even if the vehicle's master data changes later.
 * customer_name/customer_phone are entered fresh every visit (never
 * auto-filled - see components/maintenance-form.tsx), consistent with
 * "Customer remains Snapshot Data" in AI_CONTEXT.md's locked architecture
 * decisions.
 */

/**
 * Status is intentionally untyped (plain string) rather than a fixed union.
 * Defining a specific status workflow is a business-logic decision this
 * sprint is not authorized to make. Replace with a real union once a
 * requirements sprint defines the actual PM lifecycle.
 */
export type MaintenanceRecordStatus = string;

export interface MaintenanceRecord {
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
  status: MaintenanceRecordStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Shape accepted when creating a Maintenance Record via the search-first
 * workflow. Server assigns id/audit fields and generates pm_number (never
 * client-set, mirrors how QIR's job_id is server-generated in
 * `SupabaseMaintenanceRepository`, not accepted from the request body).
 */
export type MaintenanceRecordCreateInput = Pick<
  MaintenanceRecord,
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
  /** The date the maintenance was actually performed (today, by default -
   *  this workflow records a visit happening now, not a future appointment). */
  performed_date: string;
  /** GPS is optional (Phase 3) - omit entirely, or send null, if the
   *  technician didn't capture a location. */
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  google_maps_url?: string | null;
};

/** Shape accepted when updating a Maintenance Record. All fields optional (partial patch). */
export type MaintenanceRecordUpdateInput = Partial<
  Pick<
    MaintenanceRecord,
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

/** Params for the pre-save duplicate check: same tractor + same maintenance
 *  interval + same performed date already recorded (Active rows only). */
export interface MaintenanceDuplicateCheckParams {
  serial: string;
  pmIntervalId: string;
  performedDate: string;
}

export type MaintenanceHistorySortField = 'performed_date' | 'pm_number' | 'hour_meter' | 'created_at';
export type MaintenanceHistorySortDir = 'asc' | 'desc';

/** Server-side, paginated, filtered, searchable History query (Phase 4a).
 *  `search` is the universal search box (matches across PM number/serial/
 *  customer name/phone/technician/branch/model/notes); every other field
 *  is an Advanced Filter narrowing the same result set (AND semantics). */
export interface MaintenanceHistoryFilter {
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
  sortField?: MaintenanceHistorySortField;
  sortDir?: MaintenanceHistorySortDir;
}

export interface MaintenanceHistoryResult {
  data: MaintenanceRecord[];
  total: number;
}

/** One maintenance interval/milestone definition (a `pm_intervals` row -
 *  table name unchanged, per the refactor's backward-compatibility rule).
 *  Matches `maintenance-due/types.ts`'s `MaintenanceProgramStage` shape -
 *  this is the type name standardized for general use across the domain. */
export interface MaintenanceStage {
  pmIntervalId: string;
  label: string;
  intervalHours: number | null;
  intervalMonths: number | null;
}

/** A Product Family's full assigned Maintenance Program - an ordered list
 *  of `MaintenanceStage`s (via `maintenance_program_assignments`). */
export type MaintenanceProgram = MaintenanceStage[];

/** One of the 3 required photos on a Maintenance Record. The underlying
 *  storage stays 3 flat URL columns (`meter_photo_url`/`nameplate_photo_url`/
 *  `report_photo_url` - no destructive schema change); this type is the
 *  standardized shape for code that wants to treat them as a list. */
export type MaintenanceAttachmentKind = 'meter' | 'nameplate' | 'report';
export interface MaintenanceAttachment {
  kind: MaintenanceAttachmentKind;
  url: string;
}

/** Derives the standardized `MaintenanceAttachment[]` view from a record's
 *  3 flat photo URL columns - skips any that are missing. */
export function maintenanceAttachmentsOf(record: Pick<MaintenanceRecord, 'meter_photo_url' | 'nameplate_photo_url' | 'report_photo_url'>): MaintenanceAttachment[] {
  const attachments: MaintenanceAttachment[] = [];
  if (record.meter_photo_url) attachments.push({ kind: 'meter', url: record.meter_photo_url });
  if (record.nameplate_photo_url) attachments.push({ kind: 'nameplate', url: record.nameplate_photo_url });
  if (record.report_photo_url) attachments.push({ kind: 'report', url: record.report_photo_url });
  return attachments;
}
