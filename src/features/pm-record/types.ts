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
  scheduled_date: string | null;
  performed_date: string | null;
  hour_meter: number | null;
  pm_interval_id: string | null;
  pm_number: string | null;
  meter_photo_url: string | null;
  nameplate_photo_url: string | null;
  report_photo_url: string | null;
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
  >
>;

/** Params for the pre-save duplicate check: same tractor + same PM interval
 *  + same performed date already recorded (Active rows only). */
export interface PmDuplicateCheckParams {
  serial: string;
  pmIntervalId: string;
  performedDate: string;
}
