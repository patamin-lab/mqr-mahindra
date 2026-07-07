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

/** The `vehicles` fields the atomic commit needs when a legacy-import row's
 *  serial has no existing Tractor - a subset of `NtrTractorCreateInput`
 *  (`@/lib/db`), repeated here rather than imported so this repository
 *  interface doesn't reach across module boundaries for a 5-field shape. */
export interface NtrLegacyImportVehicleInput {
  model: string | null;
  engineNumber: string | null;
  dealerId: string;
  branchId: string | null;
  deliveryDate: string;
}

export interface NtrRepository {
  /** `session`, when passed, enforces the Dealer/Branch Scope Platform
   *  Standard (a DealerUser can never fetch a record outside their own
   *  branch) - optional only for back-compat with callers not yet
   *  migrated onto it (see `lib/dealerBranchScope.ts`). */
  getById(id: string, session?: SessionUser): Promise<NtrRecord | null>;
  /** Active (non-deleted) record already on file for this tractor serial,
   *  if any - powers "never create duplicate NTR" for both the search-first
   *  UI warning and the Legacy Import duplicate check. */
  findActiveBySerial(serial: string): Promise<NtrRecord | null>;
  /** Bulk form of `findActiveBySerial()` - one query for every serial in a
   *  Legacy Import file, instead of one query per row. Exists purely for
   *  `NtrImportService.validateRows()`'s performance (a 10,000-row file
   *  doing 10,000 sequential single-row queries was a real, confirmed
   *  defect found via live UAT - see `docs/import/NTR_HISTORICAL_IMPORT.md`'s
   *  Performance section). Keyed by the exact serial string passed in. */
  findActiveBySerials(serials: string[]): Promise<Map<string, NtrRecord>>;
  create(input: NtrRecordCreateInput, actor: { username: string }): Promise<NtrRecord>;
  update(id: string, input: NtrRecordUpdateInput, actor: { username: string }): Promise<NtrRecord>;
  /** Soft delete only - never a hard delete (record_status=Deleted, matches
   *  every other business table in this app). */
  delete(id: string, actor: { username: string }, reason?: string | null): Promise<void>;
  /** Server-side paginated/filtered/sorted/searchable query for the
   *  Tractor Registry list view and its Excel export - never returns the
   *  full table. */
  listHistory(filter: NtrHistoryFilter, session?: SessionUser): Promise<NtrHistoryResult>;
  /** Legacy Import's atomic per-row commit: Tractor + NTR + Timeline +
   *  Audit in one database transaction (the `commit_ntr_legacy_import_row`
   *  Postgres function - see docs/adr/ADR-008-Google-Drive-Decoupling.md).
   *  Persistence only, same as every other method here - `NtrImportService`
   *  still owns validation, duplicate pre-checking, and name composition. */
  commitLegacyImportRow(
    sessionId: string,
    vehicle: NtrLegacyImportVehicleInput,
    ntr: NtrRecordCreateInput,
    actor: { username: string }
  ): Promise<NtrRecord>;
}
