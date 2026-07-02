/**
 * Vehicle Life Cycle event source — Maintenance module.
 *
 * Reuses `fetchMaintenanceHistoryForSerial()` (owned by the Maintenance
 * module) rather than querying Supabase directly - the Vehicle layer
 * depends on Maintenance, never the reverse, and the timeline never
 * duplicates that module's scoping/soft-delete logic.
 */
import { SessionUser } from '@/lib/types';
import { fetchMaintenanceHistoryForSerial } from '@/features/maintenance/utils/fetchMaintenanceHistory';
import { MaintenanceRecord } from '@/features/maintenance/types';
import { VehicleEvent } from '../types';

export function mapMaintenanceRecordsToEvents(records: MaintenanceRecord[]): VehicleEvent[] {
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
  const records = await fetchMaintenanceHistoryForSerial(serial, session);
  return mapMaintenanceRecordsToEvents(records);
}
