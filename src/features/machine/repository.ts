/**
 * MachineRepository — read-only facade over `lib/db.ts`'s vehicle queries
 * (ADR-009: "New facade layer" — the underlying `vehicles` table and
 * `lib/db.ts` functions are untouched; this class exists so new code can
 * depend on Machine-named persistence rather than importing `lib/db.ts`
 * directly for these reads).
 *
 * Currently unused (no caller) - confirmed during the v2.3.2 authorization
 * review (ADR-013). Kept, not deleted, since ADR-009 documents it as
 * deliberate facade infrastructure; its signature is kept in sync with
 * `getVehicleBySerial()`'s `AuthorizationScope` fix below so it stays
 * usable rather than becoming a stale, uncompilable relic. Removal is a
 * separate dead-code-cleanup decision (see docs/OPERATIONS.md's Technical
 * Debt section), not part of this authorization fix.
 */
import { getVehicleBySerial, searchVehicles, VehicleSearchResult } from '@/lib/db';
import { AuthorizationScope } from '@/lib/dealerBranchScope';
import { Machine } from './types';

export class MachineRepository {
  async getBySerial(serial: string, scope: AuthorizationScope): Promise<Machine | null> {
    return getVehicleBySerial(serial, scope);
  }

  async search(query: string, dealerId: string | null): Promise<VehicleSearchResult[]> {
    return searchVehicles(query, dealerId);
  }
}
