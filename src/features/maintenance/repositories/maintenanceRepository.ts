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
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
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
  list(filter?: MaintenanceFilter): Promise<MaintenanceRecord[]>;
  getById(id: string): Promise<MaintenanceRecord | null>;
  create(input: MaintenanceRecordCreateInput, actor: { username: string }): Promise<MaintenanceRecord>;
  update(id: string, input: MaintenanceRecordUpdateInput, actor: { username: string }): Promise<MaintenanceRecord>;
  delete(id: string, actor: { username: string }): Promise<void>;
  /** Active record already on file for the same tractor + maintenance
   *  interval + performed date, if any - powers the pre-save duplicate
   *  warning. */
  findDuplicate(params: MaintenanceDuplicateCheckParams): Promise<MaintenanceRecord | null>;
  /** Server-side paginated/filtered/sorted/searchable query for the
   *  History Center (Phase 4a) - never returns the full table. */
  listHistory(filter: MaintenanceHistoryFilter): Promise<MaintenanceHistoryResult>;
}
