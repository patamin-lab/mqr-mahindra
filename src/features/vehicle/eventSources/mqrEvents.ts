/**
 * Vehicle Life Cycle event source — MQR (Market Quality Report) module.
 *
 * Reuses `getVehicleHistory()` (existing, already scoped via `applyScope`)
 * from `lib/db.ts` instead of a new query, so MQR's own dealer/branch/
 * soft-delete rules stay owned by MQR's data layer.
 */
import { cache } from 'react';
import { getVehicleHistory } from '@/lib/db';
import { MqrRecord, OPEN_STATUSES, SessionUser } from '@/lib/types';
import { VehicleEvent } from '../types';

const CLOSED_LIKE_STATUSES = ['Repaired', 'Closed'];

/** `React.cache()`-wrapped (Platform Stabilization, ADR-031, performance):
 *  Machine Passport's Attachments/Warranty/Quality/Activity/Related
 *  Records sections each independently call this for the same serial
 *  within one page render - `cache()` dedupes those into a single
 *  `getVehicleHistory()` read per request, same result, no new query
 *  path, no behavior change. */
export const fetchMqrRecords = cache(async (serial: string, session: SessionUser): Promise<MqrRecord[]> => {
  return getVehicleHistory(serial, session);
});

export function mapMqrRecordsToEvents(records: MqrRecord[]): VehicleEvent[] {
  const events: VehicleEvent[] = [];
  for (const r of records) {
    if (r.found_date) {
      events.push({
        type: 'MqrOpened',
        date: r.found_date,
        referenceNumber: r.job_id,
        description: [r.problem_system, r.problem_code].filter(Boolean).join(' - ') || 'แจ้งปัญหาคุณภาพ',
        user: r.reporter_name ?? r.user_name,
        status: r.status,
        href: `/records/${encodeURIComponent(r.job_id)}`,
      });
    }
    if (CLOSED_LIKE_STATUSES.includes(r.status) && r.repair_date) {
      events.push({
        type: 'MqrClosed',
        date: r.repair_date,
        referenceNumber: r.job_id,
        description: r.corrective_action || r.technician_action || 'ปิดงานซ่อม',
        user: r.technician_name,
        status: r.status,
        href: `/records/${encodeURIComponent(r.job_id)}`,
      });
    }
  }
  return events;
}

export function hasOpenMqrJob(records: MqrRecord[]): boolean {
  return records.some((r) => (OPEN_STATUSES as readonly string[]).includes(r.status));
}

export async function getMqrEvents(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  const records = await fetchMqrRecords(serial, session);
  return mapMqrRecordsToEvents(records);
}
