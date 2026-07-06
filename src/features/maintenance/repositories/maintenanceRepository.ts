/**
 * Maintenance — repository interface.
 *
 * Defines the data-access contract only. No implementation here (see
 * `supabaseMaintenanceRepository.ts` for the Supabase-backed adapter).
 * Existing code in `src/lib/db.ts` does not use a repository abstraction at
 * all — every admin table talks to Supabase directly through plain
 * functions. That pattern is left untouched; this interface is scoped to
 * this module only, not a retrofit of legacy code.
 */
import type { SessionUser } from '@/lib/types';
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
  MaintenanceLockReason,
  MaintenanceRecord,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
} from '../types';

export interface MaintenanceFilter {
  dealerId?: string | null;
  branchId?: string | null;
  status?: string;
}

export interface MaintenanceRepository {
  list(filter?: MaintenanceFilter, session?: SessionUser): Promise<MaintenanceRecord[]>;
  /** `session`, when passed, enforces the Dealer/Branch Scope Platform
   *  Standard (a DealerUser can never fetch a record outside their own
   *  branch) - optional only for back-compat with callers not yet
   *  migrated onto it (see `lib/dealerBranchScope.ts`). */
  getById(id: string, session?: SessionUser): Promise<MaintenanceRecord | null>;
  create(input: MaintenanceRecordCreateInput, actor: { username: string }): Promise<MaintenanceRecord>;
  update(id: string, input: MaintenanceRecordUpdateInput, actor: { username: string }): Promise<MaintenanceRecord>;
  /** `reason` is required by the Service layer when deleting an already-
   *  locked record (mandatory per spec); optional/ignored otherwise. */
  delete(id: string, actor: { username: string }, reason?: string | null): Promise<void>;
  /** Active record already on file for the same tractor + maintenance
   *  interval + performed date, if any - powers the pre-save duplicate
   *  warning. */
  findDuplicate(params: MaintenanceDuplicateCheckParams): Promise<MaintenanceRecord | null>;
  /** Server-side paginated/filtered/sorted/searchable query for the
   *  History Center (Phase 4a) - never returns the full table. */
  listHistory(filter: MaintenanceHistoryFilter, session?: SessionUser): Promise<MaintenanceHistoryResult>;

  /** Sets `locked_at`/`locked_reason` on one record (explicit lock action -
   *  "Administrative Lock", or "Superseded" via
   *  `lockSupersededRecordsForVehicle` below). */
  lockRecord(id: string, reason: MaintenanceLockReason, actor: { username: string }): Promise<MaintenanceRecord>;
  /** Opens a temporary override window (`unlocked_until`) - Central/
   *  SuperAdmin only, enforced by the Service layer, not here. */
  unlockRecord(id: string, until: string, actor: { username: string }): Promise<MaintenanceRecord>;
  /** Locks every other active record for this vehicle serial that is no
   *  longer the most recent one (by performed_date, tie-broken by
   *  created_at) and isn't already locked. Returns the ids newly locked,
   *  so the Service layer can write one audit event per record. Idempotent
   *  - a vehicle whose ordering hasn't changed locks nothing new. */
  lockSupersededRecordsForVehicle(serial: string, actor: { username: string }): Promise<string[]>;
}
