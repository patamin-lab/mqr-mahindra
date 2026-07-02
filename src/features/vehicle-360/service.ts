/**
 * Vehicle 360 — Timeline service layer.
 *
 * Aggregates read-only events already owned by other modules into one
 * chronological Vehicle Life Cycle timeline. Never writes anything, never
 * stores its own copy of another module's rows, and never computes
 * Maintenance Due/Health/Compliance business rules - the header summary
 * that used to live here moved to `VehicleSummaryService` (Phase 5b), which
 * owns all of that; this file stays true to "Timeline must continue
 * reading from events only."
 */
import { SessionUser } from '@/lib/types';
import { VEHICLE_EVENT_SOURCES } from './registry';
import { VehicleEvent } from './types';

export async function getVehicleTimeline(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  const eventLists = await Promise.all(VEHICLE_EVENT_SOURCES.map((source) => source(serial, session)));
  return eventLists.flat().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
