/**
 * Vehicle Life Cycle event source — Maintenance (PM Record) module.
 *
 * Reuses `PmRecordService.listHistory()` (Phase 4a) rather than querying
 * Supabase directly, so this module's own scoping/soft-delete rules stay in
 * one place (`SupabasePmRecordRepository`) — the timeline never duplicates
 * that logic.
 */
import { seesAllDealers } from '@/lib/scope';
import { SessionUser } from '@/lib/types';
import { PmRecordService } from '@/features/pm-record/service';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecord } from '@/features/pm-record/types';
import { VehicleEvent } from '../types';

/** Raw, scoped PM Records for one serial — also used by the Vehicle 360
 *  header (current hour meter / next maintenance due) so both the header
 *  and the timeline read from the same single query. */
export async function fetchMaintenanceRecords(serial: string, session: SessionUser): Promise<PmRecord[]> {
  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

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
  // History Center's search box) - narrow to an exact match here so the
  // timeline never shows another vehicle's records.
  return result.data.filter((r) => r.serial === serial);
}

export function mapMaintenanceRecordsToEvents(records: PmRecord[]): VehicleEvent[] {
  return records
    .filter((r) => r.performed_date)
    .map((r) => ({
      type: 'MaintenanceCompleted',
      date: r.performed_date as string,
      referenceNumber: r.pm_number ?? r.id,
      description: r.hour_meter != null ? `บำรุงรักษาเชิงป้องกัน (เลขไมล์ ${r.hour_meter} ชม.)` : 'บำรุงรักษาเชิงป้องกัน',
      user: r.technician_name,
      status: r.status,
      href: `/pm-records/${r.id}`,
    }));
}

export async function getMaintenanceEvents(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  const records = await fetchMaintenanceRecords(serial, session);
  return mapMaintenanceRecordsToEvents(records);
}
