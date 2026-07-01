/**
 * PM Record — repository interface.
 *
 * Defines the data-access contract only. No implementation here (see
 * `supabaseRepository.ts` for the Supabase-backed adapter, currently
 * stubbed). Existing code in `src/lib/db.ts` does not use a repository
 * abstraction at all — every admin table talks to Supabase directly
 * through plain functions. That pattern is left untouched; this interface
 * is new structure for the new module only, not a retrofit of legacy code.
 */
import { PmDuplicateCheckParams, PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

export interface PmRecordFilter {
  dealerId?: string | null;
  branchId?: string | null;
  status?: string;
}

export interface PmRecordRepository {
  list(filter?: PmRecordFilter): Promise<PmRecord[]>;
  getById(id: string): Promise<PmRecord | null>;
  create(input: PmRecordCreateInput, actor: { username: string }): Promise<PmRecord>;
  update(id: string, input: PmRecordUpdateInput, actor: { username: string }): Promise<PmRecord>;
  delete(id: string, actor: { username: string }): Promise<void>;
  /** Active PM record already on file for the same tractor + PM interval +
   *  performed date, if any - powers the pre-save duplicate warning. */
  findDuplicate(params: PmDuplicateCheckParams): Promise<PmRecord | null>;
}
