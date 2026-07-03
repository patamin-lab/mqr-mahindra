/**
 * NTR — repository interface.
 *
 * Defines the data-access contract only; see `supabaseNtrRepository.ts` for
 * the Supabase-backed adapter. Mirrors
 * `src/features/maintenance/repositories/maintenanceRepository.ts`'s shape
 * exactly, per docs/standards/MODULE_DEVELOPMENT_STANDARD.md.
 */
import { NtrHistoryFilter, NtrHistoryResult, NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';

export interface NtrRepository {
  getById(id: string): Promise<NtrRecord | null>;
  /** Active (non-deleted) record already on file for this tractor serial,
   *  if any - powers "never create duplicate NTR" for both the search-first
   *  UI warning and the Legacy Import duplicate check. */
  findActiveBySerial(serial: string): Promise<NtrRecord | null>;
  create(input: NtrRecordCreateInput, actor: { username: string }): Promise<NtrRecord>;
  update(id: string, input: NtrRecordUpdateInput, actor: { username: string }): Promise<NtrRecord>;
  /** Soft delete only - never a hard delete (record_status=Deleted, matches
   *  every other business table in this app). */
  delete(id: string, actor: { username: string }, reason?: string | null): Promise<void>;
  /** Server-side paginated/filtered/sorted/searchable query for the
   *  Tractor Registry list view and its Excel export - never returns the
   *  full table. */
  listHistory(filter: NtrHistoryFilter): Promise<NtrHistoryResult>;
}
