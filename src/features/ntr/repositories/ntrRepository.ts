/**
 * NTR — repository interface.
 *
 * Defines the data-access contract only; see `supabaseNtrRepository.ts` for
 * the Supabase-backed adapter. Mirrors
 * `src/features/maintenance/repositories/maintenanceRepository.ts`'s shape
 * exactly, per docs/standards/MODULE_DEVELOPMENT_STANDARD.md.
 */
import type { SessionUser } from '@/lib/types';
import { NtrHistoryFilter, NtrHistoryResult, NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';

export interface NtrRepository {
  /** `session`, when passed, enforces the Dealer/Branch Scope Platform
   *  Standard (a DealerUser can never fetch a record outside their own
   *  branch) - optional only for back-compat with callers not yet
   *  migrated onto it (see `lib/dealerBranchScope.ts`). */
  getById(id: string, session?: SessionUser): Promise<NtrRecord | null>;
  /** Active (non-deleted) record already on file for this tractor serial,
   *  if any - powers "never create duplicate NTR" for the search-first UI
   *  warning. */
  findActiveBySerial(serial: string): Promise<NtrRecord | null>;
  create(input: NtrRecordCreateInput, actor: { username: string }): Promise<NtrRecord>;
  update(id: string, input: NtrRecordUpdateInput, actor: { username: string }): Promise<NtrRecord>;
  /** Soft delete only - never a hard delete (record_status=Deleted, matches
   *  every other business table in this app). */
  delete(id: string, actor: { username: string }, reason?: string | null): Promise<void>;
  /** Server-side paginated/filtered/sorted/searchable query for the
   *  Tractor Registry list view and its Excel export - never returns the
   *  full table. */
  listHistory(filter: NtrHistoryFilter, session?: SessionUser): Promise<NtrHistoryResult>;
}
