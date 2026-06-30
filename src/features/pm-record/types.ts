/**
 * PM Record (Preventive Maintenance) — shared types.
 *
 * Foundation only (Sprint 10.1). No `pm_records` table exists yet, and no
 * requirements document defines this entity's real field set — see the
 * feature README. Fields below are the minimal, generic set any
 * maintenance-style record would need (mirrors the audit-field and FK
 * conventions already used by `MqrRecord` in `@/lib/types`), not a
 * finalized business schema. Do not extend this speculatively; wait for a
 * requirements-bearing sprint, the same way the original "Customer" gap
 * was handled rather than guessed at.
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
  technician_id: string | null;
  scheduled_date: string | null;
  performed_date: string | null;
  status: PmRecordStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** Shape accepted when creating a PM Record. Server assigns id/audit fields. */
export type PmRecordCreateInput = Pick<
  PmRecord,
  'dealer_id' | 'branch_id' | 'serial' | 'technician_id' | 'scheduled_date' | 'status' | 'notes'
>;

/** Shape accepted when updating a PM Record. All fields optional (partial patch). */
export type PmRecordUpdateInput = Partial<
  Pick<
    PmRecord,
    'branch_id' | 'serial' | 'technician_id' | 'scheduled_date' | 'performed_date' | 'status' | 'notes'
  >
>;
