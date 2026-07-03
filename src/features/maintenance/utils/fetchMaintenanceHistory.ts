/**
 * Scoped Maintenance history for one vehicle serial - owned by the
 * Maintenance module so both the Vehicle Timeline (`vehicle/eventSources`)
 * and `MaintenanceSummaryProvider` read through the same one place, rather
 * than each re-implementing the scoping/exact-match logic. This is the
 * dependency direction "Vehicle360 depends only on VehicleSummaryProvider..
 * each module implements its own provider" is meant to establish: Vehicle
 * depends on Maintenance, never the reverse.
 */
import { seesAllDealers } from '@/lib/scope';
import { SessionUser } from '@/lib/types';
import { MaintenanceService } from '../services/maintenanceService';
import { SupabaseMaintenanceRepository } from '../repositories/supabaseMaintenanceRepository';
import { MaintenanceRecord } from '../types';

/** Raw, scoped Maintenance Records for one serial, newest first. */
export async function fetchMaintenanceHistoryForSerial(serial: string, session: SessionUser): Promise<MaintenanceRecord[]> {
  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  const dealerId = seesAllDealers(session.role) ? undefined : session.dealerId ?? undefined;
  const branchName = !seesAllDealers(session.role) && session.branch ? session.branch : undefined;

  const result = await service.listHistory({
    dealerId,
    branchName,
    serial,
    page: 1,
    pageSize: 200,
    sortField: 'performed_date',
    sortDir: 'desc',
  });

  // `listHistory`'s serial filter is a substring `ilike` (built for the
  // History Center's search box) - narrow to an exact match here so
  // consumers never see another vehicle's records.
  return result.data.filter((r) => r.serial === serial);
}
