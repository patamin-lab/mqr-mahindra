/**
 * VehicleSummaryService — aggregates maintenance and quality summaries for
 * Vehicle 360 (Phase 5b).
 *
 * Orchestration only: resolves Product Family, loads the assigned
 * Maintenance Program, loads maintenance/MQR history through the same
 * module-owned reads Vehicle 360's Timeline already uses (Phase 5a's
 * `fetchMaintenanceRecords`/`fetchMqrRecords`), then delegates all actual
 * business-rule computation to `MaintenanceDueService`/`VehicleHealthService`.
 * Never duplicates another module's data, never computes Due/Health rules
 * itself - mirrors `src/features/vehicle-360/service.ts`'s existing
 * "aggregate and display results only" pattern, just with the fuller
 * Phase 5b field set.
 */
import {
  getVehicleBySerial,
  getDealer,
  getBranchById,
  getProductFamilyIdForModel,
  getProductFamily,
  listMaintenanceProgramStagesForFamily,
} from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { OPEN_STATUSES, SessionUser } from '@/lib/types';
import { fetchMaintenanceRecords } from '@/features/vehicle-360/eventSources/maintenanceEvents';
import { fetchMqrRecords } from '@/features/vehicle-360/eventSources/mqrEvents';
import { MaintenanceDueService } from '@/features/maintenance-due/service';
import { MaintenanceHistoryEntry, MaintenanceProgramStage } from '@/features/maintenance-due/types';
import { VehicleHealthService, REPEATED_MQR_WINDOW_DAYS } from '@/features/vehicle-health/service';
import { MqrRecord } from '@/lib/types';
import { VehicleSummary } from './types';

const maintenanceDueService = new MaintenanceDueService();
const vehicleHealthService = new VehicleHealthService();

/** 2+ MQR opened for this vehicle within the configured lookback window -
 *  feeds the Vehicle Health Engine's "repeated MQR" rule. */
function hasRepeatedMqrWithinWindow(mqrRecords: MqrRecord[], currentDate: string): boolean {
  const windowStart = new Date(currentDate);
  windowStart.setDate(windowStart.getDate() - REPEATED_MQR_WINDOW_DAYS);
  const windowStartIso = windowStart.toISOString().slice(0, 10);
  const count = mqrRecords.filter((r) => r.found_date && r.found_date >= windowStartIso).length;
  return count >= 2;
}

export class VehicleSummaryService {
  async getSummary(serial: string, session: SessionUser): Promise<VehicleSummary | null> {
    const dealerScope = seesAllDealers(session.role) ? null : session.dealerId;
    const [vehicle, maintenanceRecords, mqrRecords] = await Promise.all([
      getVehicleBySerial(serial, dealerScope),
      fetchMaintenanceRecords(serial, session),
      fetchMqrRecords(serial, session),
    ]);
    if (!vehicle) return null;

    const [dealer, branch, productFamilyId] = await Promise.all([
      vehicle.dealer_id ? getDealer(vehicle.dealer_id) : Promise.resolve(null),
      vehicle.branch_id ? getBranchById(vehicle.branch_id) : Promise.resolve(null),
      vehicle.model ? getProductFamilyIdForModel(vehicle.model) : Promise.resolve(null),
    ]);

    const [productFamily, stages] = await Promise.all([
      productFamilyId ? getProductFamily(productFamilyId) : Promise.resolve(null),
      productFamilyId ? listMaintenanceProgramStagesForFamily(productFamilyId) : Promise.resolve([]),
    ]);

    // Maintenance/MQR records are already sorted newest-first (see
    // fetchMaintenanceRecords/fetchMqrRecords).
    const latestMaintenance = maintenanceRecords[0] ?? null;
    const latestMqr = mqrRecords[0] ?? null;
    const ownerFromMaintenance = latestMaintenance?.customer_name ? latestMaintenance : null;
    const ownerFromMqr = latestMqr?.customer_name ? latestMqr : null;
    const newerOwnerSource =
      ownerFromMaintenance && ownerFromMqr
        ? (ownerFromMaintenance.performed_date ?? '') >= (ownerFromMqr.found_date ?? '')
          ? ownerFromMaintenance
          : ownerFromMqr
        : ownerFromMaintenance ?? ownerFromMqr;

    const history: MaintenanceHistoryEntry[] = maintenanceRecords
      .filter((r) => r.performed_date)
      .map((r) => ({ performedDate: r.performed_date as string, hourMeter: r.hour_meter, pmIntervalId: r.pm_interval_id }));

    const dueStages: MaintenanceProgramStage[] = stages.map((s) => ({
      pmIntervalId: s.pmIntervalId,
      label: s.label,
      intervalHours: s.intervalHours,
      intervalMonths: s.intervalMonths,
    }));

    const currentDate = new Date().toISOString().slice(0, 10);
    const { due, compliance, lastCompletedOnSchedule } = maintenanceDueService.evaluate({
      currentHourMeter: latestMaintenance?.hour_meter ?? null,
      currentDate,
      stages: dueStages,
      history,
    });

    const openMqrCount = mqrRecords.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)).length;
    const repeatedMqrWithinPeriod = hasRepeatedMqrWithinWindow(mqrRecords, currentDate);
    // No Campaign module exists yet in this codebase - always 0 until one does.
    const pendingCampaignCount = 0;

    const incompleteMaintenancePhotos = latestMaintenance
      ? !latestMaintenance.meter_photo_url || !latestMaintenance.nameplate_photo_url || !latestMaintenance.report_photo_url
      : false;
    const missingGps = latestMaintenance ? latestMaintenance.latitude == null || latestMaintenance.longitude == null : false;

    const health = vehicleHealthService.calculate({
      maintenanceStatus: due.status,
      lastCompletedOnSchedule,
      openMqrCount,
      repeatedMqrWithinPeriod,
      pendingCampaignCount,
      incompleteMaintenancePhotos,
      missingGps,
    });

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

      productFamilyId: productFamilyId ?? null,
      productFamilyName: productFamily?.name ?? null,
      maintenanceProgramStages: stages.map((s) => ({ label: s.label, intervalHours: s.intervalHours, intervalMonths: s.intervalMonths })),

      currentHourMeter: latestMaintenance?.hour_meter ?? null,
      lastMaintenanceDate: due.lastMaintenanceDate,
      nextMaintenanceLabel: due.nextMaintenanceLabel,
      nextMaintenanceDueDate: due.nextMaintenanceDueDate,
      nextMaintenanceDueHours: due.nextMaintenanceDueHours,
      remainingHours: due.remainingHours,
      remainingDays: due.remainingDays,
      maintenanceStatus: due.status,
      maintenanceDueLabel: due.dueLabel,
      maintenanceDueColor: due.dueColor,

      healthScore: health.score,
      healthStatus: health.status,

      compliancePercent: compliance.compliancePercent,
      completedStageCount: compliance.completedStageCount,
      expectedStageCount: compliance.expectedStageCount,

      openMqrCount,
      pendingCampaignCount,
      vehicleStatus: openMqrCount > 0 ? 'open_job' : 'normal',
    };
  }
}
