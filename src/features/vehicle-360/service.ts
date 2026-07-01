/**
 * Vehicle 360 — service layer.
 *
 * Aggregates read-only data already owned by other modules (vehicles master,
 * Maintenance/PM Record, MQR) into one header summary and one chronological
 * timeline. Never writes anything, never stores its own copy of another
 * module's rows.
 */
import { getVehicleBySerial, getDealer, getBranchById } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { SessionUser } from '@/lib/types';
import { VEHICLE_EVENT_SOURCES } from './registry';
import { MaintenanceStatus, Vehicle360Header, VehicleEvent } from './types';
import { fetchMaintenanceRecords } from './eventSources/maintenanceEvents';
import { fetchMqrRecords, hasOpenMqrJob } from './eventSources/mqrEvents';

const DUE_SOON_WINDOW_DAYS = 30;

/** Simple date-only comparison (Overdue/Due Soon/Normal), matching the same
 *  logic already used by the Maintenance History Center's quick filters.
 *  Month-based intervals only, for the same reason `next_pm_due` itself is
 *  month-based today (see `pm-record/types.ts`) — a full hour-based Due
 *  Engine is a separate, larger piece of work (Phase 5b). */
function classifyMaintenanceStatus(nextDue: string | null): MaintenanceStatus {
  if (!nextDue) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  if (nextDue < today) return 'overdue';
  const soon = new Date();
  soon.setDate(soon.getDate() + DUE_SOON_WINDOW_DAYS);
  if (nextDue <= soon.toISOString().slice(0, 10)) return 'due_soon';
  return 'normal';
}

export async function getVehicle360Header(serial: string, session: SessionUser): Promise<Vehicle360Header | null> {
  const dealerScope = seesAllDealers(session.role) ? null : session.dealerId;
  const [vehicle, maintenanceRecords, mqrRecords] = await Promise.all([
    getVehicleBySerial(serial, dealerScope),
    fetchMaintenanceRecords(serial, session),
    fetchMqrRecords(serial, session),
  ]);

  if (!vehicle) return null;

  const [dealer, branch] = await Promise.all([
    vehicle.dealer_id ? getDealer(vehicle.dealer_id) : null,
    vehicle.branch_id ? getBranchById(vehicle.branch_id) : null,
  ]);

  // Maintenance records are already sorted by performed_date desc.
  const latestMaintenance = maintenanceRecords[0] ?? null;
  // Owner info: whichever module has the more recent contact snapshot for
  // this vehicle (PM Record and MQR both capture customer name/phone fresh
  // at time of visit — neither is a live join back to a "customer" table,
  // since none exists).
  const latestMqr = mqrRecords[0] ?? null;
  const ownerFromMaintenance = latestMaintenance?.customer_name ? latestMaintenance : null;
  const ownerFromMqr = latestMqr?.customer_name ? latestMqr : null;
  const newerOwnerSource =
    ownerFromMaintenance && ownerFromMqr
      ? (ownerFromMaintenance.performed_date ?? '') >= (ownerFromMqr.found_date ?? '')
        ? ownerFromMaintenance
        : ownerFromMqr
      : ownerFromMaintenance ?? ownerFromMqr;

  return {
    serial: vehicle.serial,
    model: vehicle.model,
    engineNumber: vehicle.engine_number ?? null,
    retailDate: vehicle.delivery_date,
    dealerId: vehicle.dealer_id,
    dealerName: dealer?.short_name ?? null,
    branchName: branch?.name ?? null,
    ownerName: newerOwnerSource?.customer_name ?? null,
    ownerPhone: newerOwnerSource?.customer_phone ?? null,
    currentHourMeter: latestMaintenance?.hour_meter ?? null,
    maintenanceStatus: classifyMaintenanceStatus(latestMaintenance?.next_pm_due ?? null),
    nextMaintenanceDate: latestMaintenance?.next_pm_due ?? null,
    vehicleStatus: hasOpenMqrJob(mqrRecords) ? 'open_job' : 'normal',
  };
}

export async function getVehicleTimeline(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  const eventLists = await Promise.all(VEHICLE_EVENT_SOURCES.map((source) => source(serial, session)));
  return eventLists.flat().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
