/**
 * PM Record — Supabase-backed repository implementation.
 *
 * Reuses the existing server-only client from `@/lib/supabase` (same
 * pattern every other table in `src/lib/db.ts` uses) rather than creating
 * a second Supabase client/connection. Every method is a stub: no
 * `pm_records` table exists yet, and per this repo's existing convention
 * (see Sprint 8/9 history), a table is never created without its own
 * proposal + explicit approval step. Implementing real queries against a
 * table that doesn't exist would not build.
 */
import { getSupabase } from '@/lib/supabase';
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

const NOT_IMPLEMENTED = 'PM Record Supabase repository is not implemented yet (no pm_records table exists).';

export class SupabasePmRecordRepository implements PmRecordRepository {
  /** Kept private and unused beyond construction until real queries are
   *  implemented - confirms this class is wired to the same client
   *  abstraction as the rest of the app, not a placeholder disconnected
   *  from it. */
  private readonly client = getSupabase();

  async list(_filter?: PmRecordFilter): Promise<PmRecord[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getById(_id: string): Promise<PmRecord | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async create(_input: PmRecordCreateInput, _actor: { username: string }): Promise<PmRecord> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async update(_id: string, _input: PmRecordUpdateInput, _actor: { username: string }): Promise<PmRecord> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async delete(_id: string, _actor: { username: string }): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
