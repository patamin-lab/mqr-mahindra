/**
 * MachineRepository — read-only facade over `lib/db.ts`'s vehicle queries
 * (ADR-009: "New facade layer" — the underlying `vehicles` table and
 * `lib/db.ts` functions are untouched; this class exists so new code can
 * depend on Machine-named persistence rather than importing `lib/db.ts`
 * directly for these reads).
 */
import { getVehicleBySerial, searchVehicles, VehicleSearchResult } from '@/lib/db';
import { Machine } from './types';

export class MachineRepository {
  async getBySerial(serial: string, dealerId: string | null): Promise<Machine | null> {
    return getVehicleBySerial(serial, dealerId);
  }

  async search(query: string, dealerId: string | null): Promise<VehicleSearchResult[]> {
    return searchVehicles(query, dealerId);
  }
}
