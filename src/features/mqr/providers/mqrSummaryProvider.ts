/**
 * MqrSummaryProvider — MQR's contribution to Vehicle 360.
 *
 * The MQR module itself has not been moved into `src/features/mqr/` (it
 * still lives under `src/app/(app)/records`, `src/app/(app)/report`, and
 * `src/lib/db.ts` - see PROJECT_STATE.md for why re-homing it is
 * deliberately out of scope for this refactor). This provider is a thin,
 * purely-additive adapter: it reads through the exact same existing,
 * unmodified `getVehicleHistory()` read every other MQR consumer uses, and
 * implements `VehicleSummaryProvider` (owned by `vehicle/types.ts`) so
 * Vehicle 360 can depend on it without ever touching `lib/db.ts` directly.
 */
import { getVehicleHistory } from '@/lib/db';
import { MqrRecord, OPEN_STATUSES, SessionUser } from '@/lib/types';
import { VehicleSummary, VehicleSummaryProvider } from '@/features/vehicle/types';

/** Lookback window for the "repeated MQR" Vehicle Health signal - matches
 *  `vehicle-health/service.ts`'s `REPEATED_MQR_WINDOW_DAYS` constant. */
const REPEATED_MQR_WINDOW_DAYS = 90;

function hasRepeatedMqrWithinWindow(records: MqrRecord[], currentDate: string): boolean {
  const windowStart = new Date(currentDate);
  windowStart.setDate(windowStart.getDate() - REPEATED_MQR_WINDOW_DAYS);
  const windowStartIso = windowStart.toISOString().slice(0, 10);
  return records.filter((r) => r.found_date && r.found_date >= windowStartIso).length >= 2;
}

export class MqrSummaryProvider implements VehicleSummaryProvider {
  async getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null> {
    const records = await getVehicleHistory(serial, session);
    const latest = records[0] ?? null;
    const currentDate = new Date().toISOString().slice(0, 10);
    const openMqrCount = records.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)).length;

    return {
      ownerName: latest?.customer_name ?? null,
      ownerPhone: latest?.customer_phone ?? null,
      openMqrCount,
      repeatedMqrWithinPeriod: hasRepeatedMqrWithinWindow(records, currentDate),
      vehicleStatus: openMqrCount > 0 ? 'open_job' : 'normal',
    };
  }
}
