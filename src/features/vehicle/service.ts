/**
 * Vehicle — Timeline + Summary aggregation layer.
 *
 * "Vehicle360 becomes an aggregation layer only. It must not contain
 * business logic. It must not query module repositories directly." This
 * file honors that: `getVehicleSummary()` resolves only core vehicle
 * identity itself (dealer/branch/model - not owned by any business
 * module), then collects each registered `VehicleSummaryProvider`'s
 * contribution and merges them. Health Score is computed here (not inside
 * any one provider) because it's the one genuinely cross-module
 * calculation - it needs both Maintenance's and MQR's signals.
 * `getVehicleTimeline()` is unchanged from Phase 5a - it still reads from
 * events only.
 */
import { getVehicleBySerial, getDealer, getBranchById } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { SessionUser } from '@/lib/types';
import { VehicleHealthService } from '@/features/vehicle-health/service';
import { VEHICLE_EVENT_SOURCES } from './registry';
import { VEHICLE_SUMMARY_PROVIDERS } from './providers/registry';
import { VehicleEvent, VehicleSummary } from './types';

const vehicleHealthService = new VehicleHealthService();

export async function getVehicleTimeline(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  const eventLists = await Promise.all(VEHICLE_EVENT_SOURCES.map((source) => source(serial, session)));
  return eventLists.flat().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Merges one provider's contribution into the accumulated summary -
 *  whichever provider runs first (registry order) and sets a non-null
 *  value for a given field keeps it; a later provider only fills fields
 *  still empty. Applies uniformly to every field (including `ownerName`/
 *  `ownerPhone`, which multiple providers may both know). */
function mergeContribution(base: Partial<VehicleSummary>, contribution: Partial<VehicleSummary>): Partial<VehicleSummary> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(contribution)) {
    if (value === null || value === undefined) continue;
    if (merged[key] === null || merged[key] === undefined) {
      merged[key] = value;
    }
  }
  return merged as Partial<VehicleSummary>;
}

export async function getVehicleSummary(serial: string, session: SessionUser): Promise<VehicleSummary | null> {
  const dealerScope = seesAllDealers(session.role) ? null : session.dealerId;
  const vehicle = await getVehicleBySerial(serial, dealerScope);
  if (!vehicle) return null;

  const [dealer, branch, contributions] = await Promise.all([
    vehicle.dealer_id ? getDealer(vehicle.dealer_id) : Promise.resolve(null),
    vehicle.branch_id ? getBranchById(vehicle.branch_id) : Promise.resolve(null),
    Promise.all(VEHICLE_SUMMARY_PROVIDERS.map((provider) => provider.getVehicleSummary(serial, session))),
  ]);

  let merged: Partial<VehicleSummary> = {};
  for (const contribution of contributions) {
    if (contribution) merged = mergeContribution(merged, contribution);
  }

  const maintenanceStatus = merged.maintenanceStatus ?? 'none';
  const health = vehicleHealthService.calculate({
    maintenanceStatus,
    lastCompletedOnSchedule: merged.lastCompletedOnSchedule ?? null,
    openMqrCount: merged.openMqrCount ?? 0,
    repeatedMqrWithinPeriod: merged.repeatedMqrWithinPeriod ?? false,
    pendingCampaignCount: merged.pendingCampaignCount ?? 0,
    incompleteMaintenancePhotos: merged.incompleteMaintenancePhotos ?? false,
    missingGps: merged.missingGps ?? false,
  });

  return {
    serial: vehicle.serial,
    model: vehicle.model,
    engineNumber: vehicle.engine_number ?? null,
    retailDate: vehicle.delivery_date,
    dealerId: vehicle.dealer_id,
    dealerName: dealer?.short_name ?? null,
    branchName: branch?.name ?? null,

    ownerName: merged.ownerName ?? null,
    ownerPhone: merged.ownerPhone ?? null,

    productFamilyId: merged.productFamilyId ?? null,
    productFamilyName: merged.productFamilyName ?? null,
    maintenanceProgramStages: merged.maintenanceProgramStages ?? [],
    maintenanceProgramVersionNumber: merged.maintenanceProgramVersionNumber ?? null,

    currentHourMeter: merged.currentHourMeter ?? null,
    lastMaintenanceDate: merged.lastMaintenanceDate ?? null,
    nextMaintenanceLabel: merged.nextMaintenanceLabel ?? null,
    nextMaintenanceDueDate: merged.nextMaintenanceDueDate ?? null,
    nextMaintenanceDueHours: merged.nextMaintenanceDueHours ?? null,
    remainingHours: merged.remainingHours ?? null,
    remainingDays: merged.remainingDays ?? null,
    maintenanceStatus,
    maintenanceDueLabel: merged.maintenanceDueLabel ?? 'ยังไม่มีกำหนด',
    maintenanceDueColor: merged.maintenanceDueColor ?? 'gray',

    compliancePercent: merged.compliancePercent ?? null,
    completedStageCount: merged.completedStageCount ?? 0,
    expectedStageCount: merged.expectedStageCount ?? 0,

    lastCompletedOnSchedule: merged.lastCompletedOnSchedule ?? null,
    incompleteMaintenancePhotos: merged.incompleteMaintenancePhotos ?? false,
    missingGps: merged.missingGps ?? false,
    repeatedMqrWithinPeriod: merged.repeatedMqrWithinPeriod ?? false,

    healthScore: health.score,
    healthStatus: health.status,

    openMqrCount: merged.openMqrCount ?? 0,
    pendingCampaignCount: merged.pendingCampaignCount ?? 0,
    vehicleStatus: merged.vehicleStatus ?? 'normal',
  };
}
