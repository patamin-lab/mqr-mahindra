/**
 * PM Record (Preventive Maintenance) — shared types.
 *
 * Sprint 11.2: Added snapshot fields (model, delivery_date, customer_name,
 * customer_phone) to match the pm_records table migration added in this sprint.
 * These fields capture point-in-time state — there is no Customer Master.
 */

/**
 * Status is plain text — no lifecycle union yet (that is a future requirements
 * sprint). Default value when creating is 'scheduled'.
 */
export type PmRecordStatus = string;

export interface PmRecord {
  id: string;
  dealer_id: string;
  branch_id: string | null; // uuid stored as string

  // Vehicle snapshot (from VehicleAutocomplete at time of record creation)
  serial: string | null;
  model: string | null;
  delivery_date: string | null;

  // Customer snapshot (manual entry — no Customer Master)
  customer_name: string | null;
  customer_phone: string | null;

  // PM scheduling
  scheduled_date: string | null;
  performed_date: string | null;
  technician_id: string | null; // uuid stored as string

  // Status + notes
  status: PmRecordStatus;
  notes: string | null;

  // Audit (mirrors MqrRecord convention)
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** Shape accepted when creating a PM Record. Server assigns id/audit fields. */
export type PmRecordCreateInput = Pick<
  PmRecord,
  | 'dealer_id'
  | 'branch_id'
  | 'serial'
  | 'model'
  | 'delivery_date'
  | 'customer_name'
  | 'customer_phone'
  | 'scheduled_date'
  | 'status'
  | 'notes'
>;

/** Shape accepted when updating a PM Record. All fields optional (partial patch). */
export type PmRecordUpdateInput = Partial<
  Pick<
    PmRecord,
    | 'branch_id'
    | 'serial'
    | 'model'
    | 'delivery_date'
    | 'customer_name'
    | 'customer_phone'
    | 'scheduled_date'
    | 'performed_date'
    | 'status'
    | 'notes'
  >
>;
