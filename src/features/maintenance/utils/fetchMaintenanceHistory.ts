/**
 * Scoped Maintenance history for one vehicle serial - owned by the
 * Maintenance module so both the Vehicle Timeline (`vehicle/eventSources`)
 * and `MaintenanceSummaryProvider` read through the same one place, rather
 * than each re-implementing the scoping/exact-match logic. This is the
 * dependency direction "Vehicle360 depends only on VehicleSummaryProvider..
 * each module implements its own provider" is meant to establish: Vehicle
 * depends on Maintenance, never the reverse.
 */
import { cache } from 'react';
import { SessionUser } from '@/lib/types';
import { MaintenanceService } from '../services/maintenanceService';
import { SupabaseMaintenanceRepository } from '../repositories/supabaseMaintenanceRepository';
import { MaintenanceRecord } from '../types';

/** Raw, scoped Maintenance Records for one serial, newest first.
 *
 *  Dealer/Branch Scope Platform Standard: scope is resolved entirely by
 *  `listHistory(filter, session)` (`applyScope()`/`resolveBranchScope()`
 *  inside the repository) - this used to hand-roll its own dealer scoping
 *  and match `branchName` against the legacy free-text `session.branch`
 *  display string (fragile - whitespace/rename drift from the real
 *  `branches.name`), instead of the real `branch_id` UUID
 *  (`session.branchId`).
 *
 *  `React.cache()`-wrapped (Platform Stabilization, ADR-031, performance):
 *  Machine Passport's Attachments/Activity/Related Records sections and
 *  its own PM section each independently call this for the same serial
 *  within one page render - `cache()` dedupes those into a single
 *  `listHistory()` read per request, same result, no behavior change. */
export const fetchMaintenanceHistoryForSerial = cache(async (serial: string, session: SessionUser): Promise<MaintenanceRecord[]> => {
  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  const result = await service.listHistory(
    {
      serial,
      page: 1,
      pageSize: 200,
      sortField: 'performed_date',
      sortDir: 'desc',
    },
    session
  );

  // `listHistory`'s serial filter is a substring `ilike` (built for the
  // History Center's search box) - narrow to an exact match here so
  // consumers never see another vehicle's records.
  return result.data.filter((r) => r.serial === serial);
});
